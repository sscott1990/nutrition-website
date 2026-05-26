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

  const nutrientKeys = [
    "calories",
    "protein",
    "carbs",
    "fat",
    "calcium",
    "vitaminD",
    "fiber",
    "sugar"
  ];

  let appState = {
    groceries: [],
    meals: [],
    familyMembers: [],
    perMemberAverages: {},
    householdSummary: null
  };

  function roundValue(value) {
    return Math.round((value || 0) * 10) / 10;
  }

  function calculateBMI(weightLb, heightIn) {
    if (!weightLb || !heightIn) return null;
    return roundValue((weightLb / (heightIn * heightIn)) * 703);
  }

  function getEmptyNutritionTotals() {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      calcium: 0,
      vitaminD: 0,
      fiber: 0,
      sugar: 0
    };
  }

  function calculateMealNutrition(meal, groceryMap) {
    const totals = getEmptyNutritionTotals();
    const ingredientLines = [];

    if (!Array.isArray(meal.ingredients)) {
      return { totals, ingredientLines };
    }

    meal.ingredients.forEach((item) => {
      const grocery = groceryMap[item.groceryId];

      if (!grocery || !grocery.nutrition) {
        ingredientLines.push(`Missing grocery data for "${item.groceryId}" × ${item.quantity}`);
        return;
      }

      ingredientLines.push(`${grocery.name} × ${item.quantity}`);

      nutrientKeys.forEach((key) => {
        totals[key] += (grocery.nutrition[key] || 0) * item.quantity;
      });
    });

    nutrientKeys.forEach((key) => {
      totals[key] = roundValue(totals[key]);
    });

    return { totals, ingredientLines };
  }

  function normalizeDayName(day) {
    return String(day || "").trim().toLowerCase();
  }

  function getOrderedWeekDays() {
    return [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];
  }

  function buildGroceryMap(groceries) {
    const groceryMap = {};
    (groceries || []).forEach((grocery) => {
      if (grocery && grocery.id) {
        groceryMap[grocery.id] = grocery;
      }
    });
    return groceryMap;
  }

  function buildMemberMap(familyMembers) {
    const memberMap = {};
    (familyMembers || []).forEach((member) => {
      if (member && member.name) {
        memberMap[member.name.toLowerCase()] = member;
      }
      if (member && member.id) {
        memberMap[member.id.toLowerCase()] = member;
      }
    });
    return memberMap;
  }

  function calculatePerMemberAverages(meals, groceries, familyMembers) {
    const groceryMap = buildGroceryMap(groceries);
    const memberMap = buildMemberMap(familyMembers);
    const orderedDays = getOrderedWeekDays();

    const perMemberTotals = {};
    const perMemberDayCoverage = {};

    familyMembers.forEach((member) => {
      perMemberTotals[member.id] = getEmptyNutritionTotals();
      perMemberDayCoverage[member.id] = new Set();
    });

    meals.forEach((meal) => {
      const mealNutrition = calculateMealNutrition(meal, groceryMap).totals;
      const dayKey = normalizeDayName(meal.day);

      if (!Array.isArray(meal.members)) return;

      meal.members.forEach((memberRef) => {
        const lookupKey = String(memberRef || "").toLowerCase();
        const member = memberMap[lookupKey];

        if (!member || !perMemberTotals[member.id]) return;

        nutrientKeys.forEach((key) => {
          perMemberTotals[member.id][key] += mealNutrition[key];
        });

        if (orderedDays.includes(dayKey)) {
          perMemberDayCoverage[member.id].add(dayKey);
        }
      });
    });

    const perMemberAverages = {};

    familyMembers.forEach((member) => {
      const totals = perMemberTotals[member.id] || getEmptyNutritionTotals();

      perMemberAverages[member.id] = {
        totals: { ...totals },
        averages: {}
      };

      nutrientKeys.forEach((key) => {
        perMemberAverages[member.id].averages[key] = roundValue(totals[key] / 7);
      });
    });

    return perMemberAverages;
  }

  function calculateHouseholdSummary(familyMembers, perMemberAverages) {
    if (!familyMembers.length) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        calciumPercent: 0,
        vitaminDPercent: 0
      };
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let calciumPercentTotal = 0;
    let vitaminDPercentTotal = 0;

    familyMembers.forEach((member) => {
      const data = perMemberAverages[member.id];
      if (!data) return;

      const avg = data.averages;
      totalCalories += avg.calories || 0;
      totalProtein += avg.protein || 0;
      totalCarbs += avg.carbs || 0;
      totalFat += avg.fat || 0;

      const calciumTarget = member.nutritionFocus?.calcium || 0;
      const vitaminDTarget = member.nutritionFocus?.vitaminD || 0;

      const calciumPercent = calciumTarget ? (avg.calcium / calciumTarget) * 100 : 0;
      const vitaminDPercent = vitaminDTarget ? (avg.vitaminD / vitaminDTarget) * 100 : 0;

      calciumPercentTotal += calciumPercent;
      vitaminDPercentTotal += vitaminDPercent;
    });

    return {
      calories: roundValue(totalCalories / familyMembers.length),
      protein: roundValue(totalProtein / familyMembers.length),
      carbs: roundValue(totalCarbs / familyMembers.length),
      fat: roundValue(totalFat / familyMembers.length),
      calciumPercent: Math.round(calciumPercentTotal / familyMembers.length),
      vitaminDPercent: Math.round(vitaminDPercentTotal / familyMembers.length)
    };
  }

  function getProgressPercent(current, target) {
    if (!target || target <= 0) return 0;
    return Math.max(0, Math.min(140, Math.round((current / target) * 100)));
  }

  function getBarClass(percent) {
    if (percent >= 90 && percent <= 110) return "good";
    if ((percent >= 75 && percent < 90) || (percent > 110 && percent <= 125)) return "warning";
    return "danger";
  }

  function formatSummaryValue(value, suffix = "") {
    if (suffix === "%") return `${Math.round(value)}%`;
    if (suffix === "g") return `${roundValue(value)}g`;
    return `${roundValue(value)}`;
  }

  function renderAlertsFromData(familyMembers, perMemberAverages) {
    const alerts = [];

    familyMembers.forEach((member) => {
      const avg = perMemberAverages[member.id]?.averages;
      if (!avg) return;

      const calciumTarget = member.nutritionFocus?.calcium || 0;
      const vitaminDTarget = member.nutritionFocus?.vitaminD || 0;
      const proteinTarget = member.nutritionFocus?.protein || 0;

      if (calciumTarget && avg.calcium < calciumTarget * 0.8) {
        alerts.push({
          text: `${member.name} is below 80% of their 7-day calcium target.`,
          type: "warning"
        });
      }

      if (vitaminDTarget && avg.vitaminD < vitaminDTarget * 0.8) {
        alerts.push({
          text: `${member.name} is below 80% of their 7-day vitamin D target.`,
          type: "warning"
        });
      }

      if (proteinTarget && avg.protein < proteinTarget * 0.8) {
        alerts.push({
          text: `${member.name} is below 80% of their 7-day protein target.`,
          type: "info"
        });
      }

      const hasDiabetesCondition = Array.isArray(member.conditions)
        && member.conditions.some((condition) => condition.toLowerCase().includes("diabetes"));

      if (hasDiabetesCondition && member.nutritionFocus?.carbs && avg.carbs > member.nutritionFocus.carbs * 1.1) {
        alerts.push({
          text: `${member.name}'s 7-day carbohydrate average is above their target range.`,
          type: "danger"
        });
      }
    });

    return alerts.slice(0, 8);
  }

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

    if (!alerts.length) {
      alertsContainer.innerHTML = `<div class="alert-item info">No active nutrition alerts right now.</div>`;
      updateActiveAlertsCount();
      return;
    }

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
    const householdSummary = appState.householdSummary;

    if (!householdSummary) return;

    const summaryData = [
      formatSummaryValue(householdSummary.calories),
      formatSummaryValue(householdSummary.protein, "g"),
      formatSummaryValue(householdSummary.carbs, "g"),
      formatSummaryValue(householdSummary.fat, "g"),
      formatSummaryValue(householdSummary.calciumPercent, "%"),
      formatSummaryValue(householdSummary.vitaminDPercent, "%"),
      "0",
      String((appState.meals || []).length)
    ];

    summaryValues.forEach((element, index) => {
      if (summaryData[index] !== undefined) {
        element.textContent = summaryData[index];
      }
    });

    const alerts = renderAlertsFromData(appState.familyMembers, appState.perMemberAverages);
    renderAlerts(alerts);

    if (mealsLoggedCount) {
      mealsLoggedCount.textContent = String((appState.meals || []).length);
    }
  }

  function createMetricRow(label, current, target, unit = "") {
    const percent = getProgressPercent(current, target);
    const barClass = getBarClass(percent);

    return `
      <div class="metric">
        <div class="metric-row">
          <span>${label}</span>
          <span>${roundValue(current)}${unit} / ${roundValue(target)}${unit}</span>
        </div>
        <div class="progress">
          <div class="bar ${barClass}" style="width: ${Math.min(percent, 100)}%;"></div>
        </div>
      </div>
    `;
  }

  function renderFamilyMembers(members, perMemberAverages) {
    if (!familyMembersContainer) return;

    familyMembersContainer.innerHTML = "";

    if (!Array.isArray(members) || members.length === 0) {
      familyMembersContainer.innerHTML = `<p class="loading-note">No family members found.</p>`;
      return;
    }

    members.forEach((member) => {
      const bmi = calculateBMI(member.weightLb, member.heightIn);
      const averageData = perMemberAverages[member.id]?.averages || getEmptyNutritionTotals();
      const conditionsText =
        Array.isArray(member.conditions) && member.conditions.length
          ? member.conditions.join(", ")
          : "None listed";
      const goalsText =
        Array.isArray(member.healthGoals) && member.healthGoals.length
          ? member.healthGoals.join(", ")
          : "No goals listed";

      const hasDiabetes = Array.isArray(member.conditions)
        && member.conditions.some((condition) => condition.toLowerCase().includes("diabetes"));

      const card = document.createElement("article");
      card.className = `member-card${hasDiabetes ? " diabetic" : ""}`;

      card.innerHTML = `
        <div class="member-header">
          <div>
            <h3>${member.name}</h3>
            <p>${member.age ?? "N/A"} years old · ${member.sex ?? "N/A"}</p>
          </div>
          <span class="tag ${hasDiabetes ? "diabetic-tag" : ""}">
            ${hasDiabetes ? "Diabetes Focus" : "7-Day Avg"}
          </span>
        </div>

        <div class="member-content">
          <p><strong>Weight:</strong> ${member.weightLb ?? "N/A"} lbs</p>
          <p><strong>Height:</strong> ${member.heightIn ?? "N/A"} in</p>
          <p><strong>BMI:</strong> ${bmi ?? "N/A"}</p>
          <p><strong>Goals:</strong> ${goalsText}</p>
          <p><strong>Conditions:</strong> ${conditionsText}</p>
          <p><strong>Notes:</strong> ${member.notes || "No notes provided."}</p>

          ${createMetricRow("Calories", averageData.calories, member.nutritionFocus?.calories || 0)}
          ${createMetricRow("Protein", averageData.protein, member.nutritionFocus?.protein || 0, "g")}
          ${createMetricRow("Carbs", averageData.carbs, member.nutritionFocus?.carbs || 0, "g")}
          ${createMetricRow("Fat", averageData.fat, member.nutritionFocus?.fat || 0, "g")}
          ${createMetricRow("Calcium", averageData.calcium, member.nutritionFocus?.calcium || 0, "mg")}
          ${createMetricRow("Vitamin D", averageData.vitaminD, member.nutritionFocus?.vitaminD || 0, "mcg")}
          ${createMetricRow("Fiber", averageData.fiber, member.nutritionFocus?.fiber || 0, "g")}
          ${createMetricRow("Sugar", averageData.sugar, member.nutritionFocus?.sugar || 0, "g")}

          <div class="weekly-mini">
            <span>Rolling 7-day average based on assigned meals.</span>
          </div>
        </div>
      `;

      familyMembersContainer.appendChild(card);
    });
  }

  function renderWeeklyMeals(meals, groceries) {
    if (!weeklyMealsContainer) return;

    const groceryMap = buildGroceryMap(groceries);

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

      const perMemberAverages = calculatePerMemberAverages(
        Array.isArray(meals) ? meals : [],
        Array.isArray(groceries) ? groceries : [],
        Array.isArray(familyMembers) ? familyMembers : []
      );

      const householdSummary = calculateHouseholdSummary(
        Array.isArray(familyMembers) ? familyMembers : [],
        perMemberAverages
      );

      appState = {
        groceries: Array.isArray(groceries) ? groceries : [],
        meals: Array.isArray(meals) ? meals : [],
        familyMembers: Array.isArray(familyMembers) ? familyMembers : [],
        perMemberAverages,
        householdSummary
      };

      renderWeeklyMeals(appState.meals, appState.groceries);
      renderFamilyMembers(appState.familyMembers, appState.perMemberAverages);

      const currentRange = dateSelect ? dateSelect.value : "Last 7 Days";
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

  loadDashboardData();
});