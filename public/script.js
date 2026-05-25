document.addEventListener("DOMContentLoaded", () => {
  const dateSelect = document.getElementById("dateRange");
  const summaryValues = document.querySelectorAll(".summary-card strong");
  const alertsContainer = document.querySelector(".alerts");
  const memberCards = document.querySelectorAll(".member-card");
  const actionButtons = document.querySelectorAll("button");
  const weeklyMealsContainer = document.getElementById("weeklyMeals");
  const mealsLoggedCount = document.getElementById("mealsLoggedCount");

  const dashboardData = {
    "Today": {
      summary: ["1,842", "96g", "188g", "61g", "78%", "64%", "4", "0"],
      alerts: [
        { text: "Mia is below calcium target this week.", type: "warning" },
        { text: "Sarah logged a high glucose reading.", type: "danger" },
        { text: "James is under protein goal today.", type: "warning" },
        { text: "2 family members are below vitamin D target.", type: "info" }
      ]
    },
    "Last 7 Days": {
      summary: ["1,915", "102g", "194g", "63g", "82%", "69%", "3", "0"],
      alerts: [
        { text: "Vitamin D is low for 2 family members this week.", type: "warning" },
        { text: "Sarah had 3 glucose readings above target.", type: "danger" },
        { text: "Household protein intake improved this week.", type: "info" }
      ]
    },
    "Last 30 Days": {
      summary: ["1,888", "99g", "190g", "62g", "80%", "67%", "5", "0"],
      alerts: [
        { text: "Calcium average remains below target for Mia.", type: "danger" },
        { text: "Sarah's glucose trend shows occasional spikes after dinner.", type: "warning" },
        { text: "Overall meal logging consistency is strong this month.", type: "info" }
      ]
    }
  };

  function updateActiveAlertsCount() {
    const countCard = document.querySelector(".summary-card.alert strong");
    const visibleAlerts = alertsContainer.querySelectorAll(".alert-item").length;
    if (countCard) {
      countCard.textContent = visibleAlerts;
    }
  }

  function renderAlerts(alerts) {
    alertsContainer.innerHTML = "";

    alerts.forEach((alertItem) => {
      const div = document.createElement("div");
      div.className = `alert-item ${alertItem.type}`;
      div.textContent = alertItem.text;
      div.setAttribute("title", "Click to dismiss");

      div.addEventListener("click", () => {
        div.remove();
        updateActiveAlertsCount();
      });

      alertsContainer.appendChild(div);
    });

    updateActiveAlertsCount();
  }

  function updateDashboard(range) {
    const data = dashboardData[range];
    if (!data) return;

    summaryValues.forEach((element, index) => {
      if (data.summary[index] !== undefined) {
        element.textContent = data.summary[index];
      }
    });

    renderAlerts(data.alerts);

    if (mealsLoggedCount && weeklyMealsContainer) {
      const mealCount = weeklyMealsContainer.querySelectorAll(".weekly-meal-card").length;
      mealsLoggedCount.textContent = mealCount;
    }
  }

  function roundValue(value) {
    return Math.round(value * 10) / 10;
  }

  function calculateMealNutrition(meal, groceryMap) {
    const totals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      calcium: 0,
      vitaminD: 0,
      fiber: 0,
      sugar: 0
    };

    const ingredientLines = [];

    meal.ingredients.forEach((item) => {
      const grocery = groceryMap[item.groceryId];
      if (!grocery) return;

      ingredientLines.push(`${grocery.name} × ${item.quantity}`);

      totals.calories += grocery.nutrition.calories * item.quantity;
      totals.protein += grocery.nutrition.protein * item.quantity;
      totals.carbs += grocery.nutrition.carbs * item.quantity;
      totals.fat += grocery.nutrition.fat * item.quantity;
      totals.calcium += grocery.nutrition.calcium * item.quantity;
      totals.vitaminD += grocery.nutrition.vitaminD * item.quantity;
      totals.fiber += grocery.nutrition.fiber * item.quantity;
      totals.sugar += grocery.nutrition.sugar * item.quantity;
    });

    return {
      totals: {
        calories: roundValue(totals.calories),
        protein: roundValue(totals.protein),
        carbs: roundValue(totals.carbs),
        fat: roundValue(totals.fat),
        calcium: roundValue(totals.calcium),
        vitaminD: roundValue(totals.vitaminD),
        fiber: roundValue(totals.fiber),
        sugar: roundValue(totals.sugar)
      },
      ingredientLines
    };
  }

  function renderWeeklyMeals(meals, groceries) {
    if (!weeklyMealsContainer) return;

    const groceryMap = {};
    groceries.forEach((grocery) => {
      groceryMap[grocery.id] = grocery;
    });

    weeklyMealsContainer.innerHTML = "";

    meals.forEach((meal) => {
      const mealData = calculateMealNutrition(meal, groceryMap);

      const card = document.createElement("div");
      card.className = "weekly-meal-card";

      card.innerHTML = `
        <div class="weekly-meal-top">
          <div>
            <h3>${meal.day} · ${meal.mealType}</h3>
            <p>${meal.name}</p>
          </div>
        </div>

        <div class="meal-members">
          <strong>Assigned:</strong> ${meal.members.join(", ")}
        </div>

        <ul class="ingredient-list">
          ${mealData.ingredientLines.map((line) => `<li>${line}</li>`).join("")}
        </ul>

        <div class="nutrition-grid">
          <div class="nutrition-pill">
            <span>Calories</span>
            <strong>${mealData.totals.calories}</strong>
          </div>
          <div class="nutrition-pill">
            <span>Protein</span>
            <strong>${mealData.totals.protein}g</strong>
          </div>
          <div class="nutrition-pill">
            <span>Carbs</span>
            <strong>${mealData.totals.carbs}g</strong>
          </div>
          <div class="nutrition-pill">
            <span>Fat</span>
            <strong>${mealData.totals.fat}g</strong>
          </div>
          <div class="nutrition-pill">
            <span>Calcium</span>
            <strong>${mealData.totals.calcium}mg</strong>
          </div>
          <div class="nutrition-pill">
            <span>Vitamin D</span>
            <strong>${mealData.totals.vitaminD}mcg</strong>
          </div>
          <div class="nutrition-pill">
            <span>Fiber</span>
            <strong>${mealData.totals.fiber}g</strong>
          </div>
          <div class="nutrition-pill">
            <span>Sugar</span>
            <strong>${mealData.totals.sugar}g</strong>
          </div>
        </div>
      `;

      weeklyMealsContainer.appendChild(card);
    });

    if (mealsLoggedCount) {
      mealsLoggedCount.textContent = meals.length;
    }
  }

  async function loadMealData() {
    if (!weeklyMealsContainer) return;

    weeklyMealsContainer.innerHTML = `<p class="loading-note">Loading grocery library and weekly meals...</p>`;

    try {
      const [groceriesResponse, mealsResponse] = await Promise.all([
        fetch("grocery-library.json"),
        fetch("weekly-meals.json")
      ]);

      if (!groceriesResponse.ok || !mealsResponse.ok) {
        throw new Error("Could not load JSON files.");
      }

      const groceries = await groceriesResponse.json();
      const meals = await mealsResponse.json();

      renderWeeklyMeals(meals, groceries);

      const currentRange = dateSelect ? dateSelect.value : "Today";
      updateDashboard(currentRange);
    } catch (error) {
      weeklyMealsContainer.innerHTML = `<p class="loading-note">Unable to load meal data. Check that your JSON files are in the public folder and that you're serving the files through a local web server.</p>`;
      console.error(error);
    }
  }

  if (dateSelect) {
    dateSelect.addEventListener("change", (event) => {
      updateDashboard(event.target.value);
    });
  }

  memberCards.forEach((card) => {
    const header = card.querySelector(".member-header");
    const content = card.querySelector(".member-content");

    if (header && content) {
      header.addEventListener("click", () => {
        content.classList.toggle("collapsed");
      });
    }
  });

  actionButtons.forEach((button) => {
    const text = button.textContent.trim();

    const handledButtons = [
      "Add Family Member",
      "Add Grocery",
      "Create Meal",
      "View Details",
      "Edit Profile",
      "Log Glucose"
    ];

    if (handledButtons.includes(text)) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        alert(`${text} clicked.\n\nThis will connect to a real form or page later.`);
      });
    }
  });

  updateDashboard("Today");
  loadMealData();
});