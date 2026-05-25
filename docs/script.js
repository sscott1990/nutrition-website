document.addEventListener("DOMContentLoaded", () => {
  const dateSelect = document.getElementById("dateRange");
  const summaryValues = document.querySelectorAll(".summary-card strong");
  const alertsContainer = document.querySelector(".alerts");
  const actionButtons = document.querySelectorAll("button");
  const weeklyMealsContainer = document.getElementById("weeklyMeals");
  const mealsLoggedCount = document.getElementById("mealsLoggedCount");
  const familyMembersContainer = document.getElementById("familyMembers");

  const GROCERY_LIBRARY_URL = "https://nutrition-website-database.s3.us-east-1.amazonaws.com/grocery-library.json";
  const WEEKLY_MEALS_URL = "https://nutrition-website-database.s3.us-east-1.amazonaws.com/weekly-meals.json";
  const FAMILY_MEMBERS_URL = "https://nutrition-website-database.s3.us-east-1.amazonaws.com/family-members.json";

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
    const visibleAlerts = alertsContainer ? alertsContainer.querySelectorAll(".alert-item").length : 0;

    if (countCard) {
      countCard.textContent = visibleAlerts;
    }
  }

  function renderAlerts(alerts) {
    if (!alertsContainer) return;

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

  function calculateBMI(weightLb, heightIn) {
    if (!weightLb || !heightIn) return null;
    return roundValue((weightLb / (heightIn * heightIn)) * 703);
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

    if (!Array.isArray(meal.ingredients)) {
      return { totals, ingredientLines };
    }

    meal.ingredients.forEach((item) => {
      const grocery = groceryMap[item.groceryId];

      if (!grocery || !grocery.nutrition) {
        return;
      }

      ingredientLines.push(`${grocery.name} × ${item.quantity}`);

      totals.calories += (grocery.nutrition.calories || 0) * item.quantity;
      totals.protein += (grocery.nutrition.protein || 0) * item.quantity;
      totals.carbs += (grocery.nutrition.carbs || 0) * item.quantity;
      totals.fat += (grocery.nutrition.fat || 0) * item.quantity;
      totals.calcium += (grocery.nutrition.calcium || 0) * item.quantity;
      totals.vitaminD += (grocery.nutrition.vitaminD || 0) * item.quantity;
      totals.fiber += (grocery.nutrition.fiber || 0) * item.quantity;
      totals.sugar += (grocery.nutrition.sugar || 0) * item.quantity;
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

  function renderFamilyMembers(members) {
    if (!familyMembersContainer) return;

    familyMembersContainer.innerHTML = "";

    if (!Array.isArray(members) || members.length === 0) {
      familyMembersContainer.innerHTML = `<p class="loading-note">No family members found.</p>`;
      return;
    }

    members.forEach((member) => {
      const bmi = calculateBMI(member.weightLb, member.heightIn);
      const conditionsText = Array.isArray(member.conditions) && member.conditions.length
        ? member.conditions.join(", ")
        : "None listed";
      const goalsText = Array.isArray(member.healthGoals) && member.healthGoals.length
        ? member.healthGoals.join(", ")
        : "No goals listed";

      const card = document.createElement("article");
      card.className = "member-card";

      card.innerHTML = `
        <div class="member-header">
          <div>
            <h3>${member.name}</h3>
            <p>${member.age} years old · ${member.sex}</p>
          </div>
          <span>Click to expand</span>
        </div>

        <div class="member-content">
          <div class="member-stats">
            <div><strong>Weight:</strong> ${member.weightLb ?? "N/A"} lbs</div>
            <div><strong>Height:</strong> ${member.heightIn ?? "N/A"} in</div>
            <div><strong>BMI:</strong> ${bmi ?? "N/A"}</div>
          </div>

          <p><strong>Goals:</strong> ${goalsText}</p>
          <p><strong>Conditions:</strong> ${conditionsText}</p>
          <p><strong>Notes:</strong> ${member.notes || "No notes provided."}</p>

          <div class="nutrition-grid">
            <div class="nutrition-pill"><span>Calories</span><strong>${member.nutritionFocus?.calories ?? "N/A"}</strong></div>
            <div class="nutrition-pill"><span>Protein</span><strong>${member.nutritionFocus?.protein ?? "N/A"}g</strong></div>
            <div class="nutrition-pill"><span>Carbs</span><strong>${member.nutritionFocus?.carbs ?? "N/A"}g</strong></div>
            <div class="nutrition-pill"><span>Fat</span><strong>${member.nutritionFocus?.fat ?? "N/A"}g</strong></div>
            <div class="nutrition-pill"><span>Calcium</span><strong>${member.nutritionFocus?.calcium ?? "N/A"}mg</strong></div>
            <div class="nutrition-pill"><span>Vitamin D</span><strong>${member.nutritionFocus?.vitaminD ?? "N/A"}mcg</strong></div>
            <div class="nutrition-pill"><span>Fiber</span><strong>${member.nutritionFocus?.fiber ?? "N/A"}g</strong></div>
            <div class="nutrition-pill"><span>Sugar</span><strong>${member.nutritionFocus?.sugar ?? "N/A"}g</strong></div>
          </div>
        </div>
      `;

      familyMembersContainer.appendChild(card);
    });

    const memberCards = familyMembersContainer.querySelectorAll(".member-card");

    memberCards.forEach((card) => {
      const header = card.querySelector(".member-header");
      const content = card.querySelector(".member-content");

      if (header && content) {
        header.addEventListener("click", () => {
          content.classList.toggle("collapsed");
        });
      }
    });
  }

  function renderWeeklyMeals(meals, groceries) {
    if (!weeklyMealsContainer) return;

    const groceryMap = {};
    groceries.forEach((grocery) => {
      groceryMap[grocery.id] = grocery;
    });

    weeklyMealsContainer.innerHTML = "";

    if (!Array.isArray(meals) || meals.length === 0) {
      weeklyMealsContainer.innerHTML = `<p class="loading-note">No weekly meals found.</p>`;
      if (mealsLoggedCount) {
        mealsLoggedCount.textContent = "0";
      }
      return;
    }

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
          <strong>Assigned:</strong> ${Array.isArray(meal.members) ? meal.members.join(", ") : ""}
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

  async function loadDashboardData() {
    if (weeklyMealsContainer) {
      weeklyMealsContainer.innerHTML = `<p class="loading-note">Loading dashboard data...</p>`;
    }

    if (familyMembersContainer) {
      familyMembersContainer.innerHTML = `<p class="loading-note">Loading family members...</p>`;
    }

    try {
      const [groceriesResponse, mealsResponse, familyResponse] = await Promise.all([
        fetch(GROCERY_LIBRARY_URL),
        fetch(WEEKLY_MEALS_URL),
        fetch(FAMILY_MEMBERS_URL)
      ]);

      if (!groceriesResponse.ok) {
        throw new Error(`Could not load grocery library. Status: ${groceriesResponse.status}`);
      }

      if (!mealsResponse.ok) {
        throw new Error(`Could not load weekly meals. Status: ${mealsResponse.status}`);
      }

      if (!familyResponse.ok) {
        throw new Error(`Could not load family members. Status: ${familyResponse.status}`);
      }

      const groceries = await groceriesResponse.json();
      const meals = await mealsResponse.json();
      const familyMembers = await familyResponse.json();

      renderWeeklyMeals(groceries && meals ? meals : [], groceries || []);
      renderFamilyMembers(familyMembers || []);

      const currentRange = dateSelect ? dateSelect.value : "Today";
      updateDashboard(currentRange);
    } catch (error) {
      console.error("Dashboard data load error:", error);

      if (weeklyMealsContainer) {
        weeklyMealsContainer.innerHTML = `
          <p class="loading-note">
            Unable to load meal data from S3. Check file names, object permissions, bucket CORS, and JSON validity.
          </p>
        `;
      }

      if (familyMembersContainer) {
        familyMembersContainer.innerHTML = `
          <p class="loading-note">
            Unable to load family members from S3. Check file names, object permissions, bucket CORS, and JSON validity.
          </p>
        `;
      }
    }
  }

  if (dateSelect) {
    dateSelect.addEventListener("change", (event) => {
      updateDashboard(event.target.value);
    });
  }

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
  loadDashboardData();
});