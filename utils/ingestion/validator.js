export class IngestionValidator {
  /**
   * Validates a normalized draw result based on game-specific rules.
   * @param {Object} normalizedResult 
   * @returns {{isValid: boolean, errors: Array<string>}} Validation status
   */
  validate(normalizedResult) {
    const { category, drawDate, middayWinningNumbers, eveningWinningNumbers } = normalizedResult;
    const errors = [];

    if (!category) {
      errors.push("Missing category");
    }
    if (!drawDate || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
      errors.push(`Invalid or missing drawDate: ${drawDate}`);
    }

    if (!middayWinningNumbers && !eveningWinningNumbers) {
      errors.push("Missing both midday and evening winning numbers");
      return { isValid: false, errors };
    }

    const validateNumbers = (numbers, listName) => {
      if (!numbers) return;
      if (!Array.isArray(numbers)) {
        errors.push(`${listName} winnings must be an array`);
        return;
      }

      const cat = category.toLowerCase();

      if (cat === "numbers") {
        // Daily Numbers: 3 numbers, each 0-9
        if (numbers.length !== 3) {
          errors.push(`${listName} Numbers must have exactly 3 digits, got ${numbers.length}`);
        }
        numbers.forEach(num => {
          const val = parseInt(num, 10);
          if (isNaN(val) || val < 0 || val > 9) {
            errors.push(`${listName} Numbers digit must be between 0 and 9, got ${num}`);
          }
        });
      } else if (cat === "win4") {
        // Win 4: 4 numbers, each 0-9
        if (numbers.length !== 4) {
          errors.push(`${listName} Win 4 must have exactly 4 digits, got ${numbers.length}`);
        }
        numbers.forEach(num => {
          const val = parseInt(num, 10);
          if (isNaN(val) || val < 0 || val > 9) {
            errors.push(`${listName} Win 4 digit must be between 0 and 9, got ${num}`);
          }
        });
      } else if (cat === "take5") {
        // Take 5: 5 unique numbers between 1 and 39
        if (numbers.length !== 5) {
          errors.push(`${listName} Take 5 must have exactly 5 numbers, got ${numbers.length}`);
        }
        const parsedVals = [];
        numbers.forEach(num => {
          const val = parseInt(num, 10);
          if (isNaN(val) || val < 1 || val > 39) {
            errors.push(`${listName} Take 5 number must be between 1 and 39, got ${num}`);
          }
          parsedVals.push(val);
        });
        const uniq = new Set(parsedVals);
        if (uniq.size !== parsedVals.length) {
          errors.push(`${listName} Take 5 numbers contain duplicates`);
        }
      } else if (cat === "lotto") {
        // Lotto: 6 unique numbers (1-59) + 1 bonus (1-59)
        // Format of bonus is "Bonus: XX"
        const mainNumbers = numbers.filter(n => !n.startsWith("Bonus:"));
        const bonusPart = numbers.find(n => n.startsWith("Bonus:"));

        if (mainNumbers.length !== 6) {
          errors.push(`${listName} Lotto must have exactly 6 main numbers, got ${mainNumbers.length}`);
        }

        const mainVals = mainNumbers.map(n => {
          const val = parseInt(n, 10);
          if (isNaN(val) || val < 1 || val > 59) {
            errors.push(`${listName} Lotto main number must be between 1 and 59, got ${n}`);
          }
          return val;
        });

        const uniq = new Set(mainVals);
        if (uniq.size !== mainVals.length) {
          errors.push(`${listName} Lotto main numbers contain duplicates`);
        }

        if (bonusPart) {
          const bonusValStr = bonusPart.replace("Bonus:", "").trim();
          const bonusVal = parseInt(bonusValStr, 10);
          if (isNaN(bonusVal) || bonusVal < 1 || bonusVal > 59) {
            errors.push(`${listName} Lotto bonus number must be between 1 and 59, got ${bonusValStr}`);
          }
        } else {
          errors.push(`${listName} Lotto is missing bonus number`);
        }
      } else if (cat === "powerball") {
        // Powerball: 5 unique numbers (1-69) + 1 Powerball (1-26) + multiplier (optional)
        const main = numbers.filter(n => !n.startsWith("Powerball:") && !n.startsWith("Powerplay:"));
        const pbPart = numbers.find(n => n.startsWith("Powerball:"));

        if (main.length !== 5) {
          errors.push(`${listName} Powerball must have exactly 5 main numbers, got ${main.length}`);
        }

        const mainVals = main.map(n => {
          const val = parseInt(n, 10);
          if (isNaN(val) || val < 1 || val > 69) {
            errors.push(`${listName} Powerball main number must be between 1 and 69, got ${n}`);
          }
          return val;
        });

        const uniq = new Set(mainVals);
        if (uniq.size !== mainVals.length) {
          errors.push(`${listName} Powerball main numbers contain duplicates`);
        }

        if (pbPart) {
          const pbValStr = pbPart.replace("Powerball:", "").trim();
          const pbVal = parseInt(pbValStr, 10);
          if (isNaN(pbVal) || pbVal < 1 || pbVal > 26) {
            errors.push(`${listName} Powerball number must be between 1 and 26, got ${pbValStr}`);
          }
        } else {
          errors.push(`${listName} Powerball is missing Powerball number`);
        }
      } else if (cat === "megamillions") {
        // Mega Millions: 5 unique numbers (1-70) + 1 Mega Ball (1-25) + multiplier (optional)
        const main = numbers.filter(n => !n.startsWith("Mega Ball:") && !n.startsWith("Megaplier:"));
        const mbPart = numbers.find(n => n.startsWith("Mega Ball:"));

        if (main.length !== 5) {
          errors.push(`${listName} Mega Millions must have exactly 5 main numbers, got ${main.length}`);
        }

        const mainVals = main.map(n => {
          const val = parseInt(n, 10);
          if (isNaN(val) || val < 1 || val > 70) {
            errors.push(`${listName} Mega Millions main number must be between 1 and 70, got ${n}`);
          }
          return val;
        });

        const uniq = new Set(mainVals);
        if (uniq.size !== mainVals.length) {
          errors.push(`${listName} Mega Millions main numbers contain duplicates`);
        }

        if (mbPart) {
          const mbValStr = mbPart.replace("Mega Ball:", "").trim();
          const mbVal = parseInt(mbValStr, 10);
          if (isNaN(mbVal) || mbVal < 1 || mbVal > 25) {
            errors.push(`${listName} Mega Millions mega ball must be between 1 and 25, got ${mbValStr}`);
          }
        } else {
          errors.push(`${listName} Mega Millions is missing Mega Ball number`);
        }
      }
    };

    validateNumbers(middayWinningNumbers, "Midday");
    validateNumbers(eveningWinningNumbers, "Evening");

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
