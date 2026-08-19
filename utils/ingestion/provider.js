// Provider mapping for NY Open Data (Socrata API)

const DATASETS = {
  numbers: "hsys-3def",
  win4: "hsys-3def",
  take5: "dg63-4siq",
  lotto: "6nbc-h7bj",
  powerball: "d6yy-54nr",
  megamillions: "5xaw-6ayf"
};

export class NYOpenDataProvider {
  /**
   * Fetches lottery results from data.ny.gov Socrata API.
   * @param {string} category - Lottery category (numbers, win4, take5, lotto, powerball, megamillions)
   * @param {string} [date] - Optional date in YYYY-MM-DD format
   * @returns {Promise<Array<Object>>} Raw records from API
   */
  async fetchRawResults(category, date) {
    const datasetId = DATASETS[category.toLowerCase()];
    if (!datasetId) {
      throw new Error(`Unsupported category for automated sync: ${category}`);
    }

    let url = `https://data.ny.gov/resource/${datasetId}.json`;
    const params = new URLSearchParams();

    if (date) {
      // Socrata dates are represented as floating timestamps e.g. 2026-08-17T00:00:00.000
      const formattedDate = `${date}T00:00:00.000`;
      params.append("draw_date", formattedDate);
    } else {
      // Default to latest entries
      params.append("$order", "draw_date DESC");
      params.append("$limit", "5");
    }

    url = `${url}?${params.toString()}`;
    if (process.env.NODE_ENV !== 'production') console.log(`[Sync Provider] Fetching URL: ${url}`);

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error fetching results: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Normalizes the SODA API response into standard format.
   * @param {string} category 
   * @param {Object} rawRecord 
   * @returns {Object} Normalized result
   */
  normalize(category, rawRecord) {
    const drawDate = rawRecord.draw_date ? rawRecord.draw_date.split("T")[0] : null;
    if (!drawDate) {
      throw new Error("API record missing draw_date");
    }

    const cat = category.toLowerCase();
    let middayWinningNumbers = null;
    let eveningWinningNumbers = null;

    if (cat === "numbers") {
      // Daily Numbers: format three digits separated by commas
      if (rawRecord.midday_daily) {
        middayWinningNumbers = this.formatDigits(rawRecord.midday_daily, 3);
      }
      if (rawRecord.evening_daily) {
        eveningWinningNumbers = this.formatDigits(rawRecord.evening_daily, 3);
      }
    } else if (cat === "win4") {
      // Win 4: format four digits separated by commas
      if (rawRecord.midday_win_4) {
        middayWinningNumbers = this.formatDigits(rawRecord.midday_win_4, 4);
      }
      if (rawRecord.evening_win_4) {
        eveningWinningNumbers = this.formatDigits(rawRecord.evening_win_4, 4);
      }
    } else if (cat === "take5") {
      // Take 5: formatted as space-separated string e.g. "15 18 19 26 32"
      if (rawRecord.midday_winning_numbers) {
        middayWinningNumbers = rawRecord.midday_winning_numbers.split(" ").map(n => n.trim()).filter(Boolean);
      }
      if (rawRecord.evening_winning_numbers) {
        eveningWinningNumbers = rawRecord.evening_winning_numbers.split(" ").map(n => n.trim()).filter(Boolean);
      }
    } else if (cat === "lotto") {
      // Lotto: 6 numbers + bonus number
      if (rawRecord.winning_numbers) {
        const mainNumbers = rawRecord.winning_numbers.split(" ").map(n => n.trim()).filter(Boolean);
        const bonus = rawRecord.bonus ? rawRecord.bonus.trim() : null;
        if (bonus) {
          mainNumbers.push(`Bonus: ${bonus}`);
        }
        middayWinningNumbers = mainNumbers; // Lotto is a single drawing, mapped to midday
      }
    } else if (cat === "powerball") {
      // Powerball: 5 numbers + Powerball + multiplier
      if (rawRecord.winning_numbers) {
        const parts = rawRecord.winning_numbers.split(" ").map(n => n.trim()).filter(Boolean);
        // Last number in winning_numbers is Powerball
        if (parts.length === 6) {
          const powerball = parts[5];
          const main = parts.slice(0, 5);
          main.push(`Powerball: ${powerball}`);
          if (rawRecord.multiplier) {
            main.push(`Powerplay: ${rawRecord.multiplier}`);
          }
          middayWinningNumbers = main;
        }
      }
    } else if (cat === "megamillions") {
      // Mega Millions: 5 numbers + Megaball + multiplier
      if (rawRecord.winning_numbers) {
        const main = rawRecord.winning_numbers.split(" ").map(n => n.trim()).filter(Boolean);
        if (rawRecord.mega_ball) {
          main.push(`Mega Ball: ${rawRecord.mega_ball.trim()}`);
        }
        if (rawRecord.multiplier) {
          main.push(`Megaplier: ${rawRecord.multiplier.trim()}`);
        }
        middayWinningNumbers = main;
      }
    }

    return {
      category: cat,
      drawDate,
      middayWinningNumbers,
      eveningWinningNumbers,
      raw: rawRecord
    };
  }

  /**
   * Helper to format digit string into array of single digit strings
   * E.g. "952" -> ["9", "5", "2"]. "3" -> ["0", "0", "3"]
   */
  formatDigits(digitStr, length) {
    let clean = digitStr.replace(/\D/g, "");
    // Pad with leading zeros if necessary
    clean = clean.padStart(length, "0");
    return clean.split("");
  }
}
