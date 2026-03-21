import { google } from "googleapis";

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_PRIVATE_KEY || "";
  // If it starts with the PEM header, it's already a key (with \n escapes or real newlines)
  if (raw.startsWith("-----BEGIN")) {
    return raw.replace(/\\n/g, "\n").replace(/"/g, "");
  }
  // Otherwise it's base64 encoded
  return Buffer.from(raw, "base64").toString("utf-8");
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: getPrivateKey(),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

export interface MealEntry {
  description: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export interface DayData {
  date: string;
  dayLabel: string;
  meals: MealEntry[];
  totals: { calories: number; fat: number; carbs: number; protein: number };
}

export interface WeekData {
  weekStart: string;
  days: DayData[];
  averages: { calories: number; fat: number; carbs: number; protein: number };
  goals: { calories: number; fat: number; carbs: number; protein: number };
}

// Get the sheet name for a given week (using the Monday date)
function getWeekSheetName(date: Date): string {
  // Find the Sunday of that week
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const month = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const dayNum = d.getDate();
  const year = d.getFullYear();
  return `${month} ${dayNum} ${year}`;
}

// Find or create the sheet tab for a given week
async function ensureWeekSheet(date: Date): Promise<string> {
  const sheets = getSheets();
  const sheetName = getWeekSheetName(date);

  // Check if sheet exists
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const existing = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (existing) return sheetName;

  // Create the sheet with the week template
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: sheetName },
          },
        },
      ],
    },
  });

  // Set up the header structure
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Row 1: Goals header
  // Row 2: Goal values
  // Row 3: Average header
  // Row 4: blank
  // Row 5: Week start date
  // Row 6: Day headers with Cal/F/C/P columns
  // Row 7+: Meal entries

  const headers: string[][] = [];

  // Row 1 - Goals label and values (placed in columns to the right)
  headers.push([
    "",
    "",
    "",
    "",
    "",
    "Goals",
    "Cal",
    "F",
    "C",
    "P",
  ]);
  headers.push([
    "",
    "",
    "",
    "",
    "",
    "",
    "2650",
    "85",
    "230",
    "180",
  ]);
  headers.push([
    "",
    "",
    "",
    "",
    "",
    "Average",
    "",
    "",
    "",
    "",
  ]);
  headers.push([]); // blank row

  // Row 5: Week date
  const weekLabel = `${sunday.toLocaleString("en-US", {
    month: "short",
  }).toLowerCase()} ${sunday.getDate()} ${sunday.getFullYear()}`;
  headers.push([weekLabel]);

  // Row 6: Day headers - each day gets 5 columns (label, Cal, F, C, P)
  const dayHeaderRow: string[] = [];
  for (let i = 0; i < 7; i++) {
    dayHeaderRow.push(dayNames[i], "Cal", "F", "C", "P");
  }
  headers.push(dayHeaderRow);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: headers },
  });

  return sheetName;
}

// Read the current week's data
export async function getCurrentWeekData(date?: Date): Promise<WeekData> {
  const targetDate = date || new Date();
  const sheetName = await ensureWeekSheet(targetDate);
  const sheets = getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:AI50`,
  });

  const rows = result.data.values || [];
  const goals = {
    calories: Number(rows[1]?.[6]) || 2650,
    fat: Number(rows[1]?.[7]) || 85,
    carbs: Number(rows[1]?.[8]) || 230,
    protein: Number(rows[1]?.[9]) || 180,
  };

  const days: DayData[] = [];
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Each day occupies 5 columns: description, Cal, F, C, P
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const colOffset = dayIndex * 5;
    const dayLabel = rows[5]?.[colOffset] || dayNames[dayIndex];

    const sunday = new Date(targetDate);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const dayDate = new Date(sunday);
    dayDate.setDate(dayDate.getDate() + dayIndex);

    const meals: MealEntry[] = [];
    let totalCal = 0,
      totalFat = 0,
      totalCarbs = 0,
      totalProtein = 0;

    // Meal rows start at row 7 (index 6)
    for (let row = 6; row < rows.length; row++) {
      const desc = rows[row]?.[colOffset];
      if (!desc || desc === "" || desc.toLowerCase().startsWith("total")) continue;

      const cal = Number(rows[row]?.[colOffset + 1]) || 0;
      const fat = Number(rows[row]?.[colOffset + 2]) || 0;
      const carbs = Number(rows[row]?.[colOffset + 3]) || 0;
      const protein = Number(rows[row]?.[colOffset + 4]) || 0;

      meals.push({
        description: desc,
        calories: cal,
        fat,
        carbs,
        protein,
      });

      totalCal += cal;
      totalFat += fat;
      totalCarbs += carbs;
      totalProtein += protein;
    }

    days.push({
      date: dayDate.toISOString().split("T")[0],
      dayLabel,
      meals,
      totals: {
        calories: totalCal,
        fat: totalFat,
        carbs: totalCarbs,
        protein: totalProtein,
      },
    });
  }

  // Calculate averages from days that have meals
  const daysWithMeals = days.filter((d) => d.meals.length > 0);
  const count = daysWithMeals.length || 1;
  const averages = {
    calories: Math.round(
      daysWithMeals.reduce((s, d) => s + d.totals.calories, 0) / count
    ),
    fat: Math.round(
      daysWithMeals.reduce((s, d) => s + d.totals.fat, 0) / count
    ),
    carbs: Math.round(
      daysWithMeals.reduce((s, d) => s + d.totals.carbs, 0) / count
    ),
    protein: Math.round(
      daysWithMeals.reduce((s, d) => s + d.totals.protein, 0) / count
    ),
  };

  return {
    weekStart: getWeekSheetName(targetDate),
    days,
    averages,
    goals,
  };
}

// --- Notes/Goals stored in a dedicated "Notes" tab ---

async function ensureNotesSheet(): Promise<string> {
  const sheets = getSheets();
  const sheetName = "Notes";

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const existing = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (existing) return sheetName;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [["Goals & Notes"]] },
  });

  return sheetName;
}

export async function getNotes(): Promise<string[]> {
  const sheetName = await ensureNotesSheet();
  const sheets = getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:A100`,
  });

  const rows = result.data.values || [];
  return rows.map((r) => r[0]).filter((v) => v && v.trim() !== "");
}

export async function saveNotes(notes: string[]): Promise<void> {
  const sheetName = await ensureNotesSheet();
  const sheets = getSheets();

  // Clear existing notes
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:A100`,
  });

  if (notes.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${sheetName}'!A2`,
      valueInputOption: "RAW",
      requestBody: { values: notes.map((n) => [n]) },
    });
  }
}

// Add a meal to a specific day
export async function addMeal(
  date: Date,
  meal: MealEntry
): Promise<void> {
  const sheetName = await ensureWeekSheet(date);
  const sheets = getSheets();
  const dayIndex = date.getDay(); // 0 = Sunday
  const colOffset = dayIndex * 5;

  // Read existing data to find the next empty row for this day
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:AI50`,
  });

  const rows = result.data.values || [];
  let targetRow = 6; // Start after headers (0-indexed, row 7 in sheet)

  for (let row = 6; row < rows.length; row++) {
    const cell = rows[row]?.[colOffset];
    if (cell && cell !== "" && !cell.toLowerCase().startsWith("total")) {
      targetRow = row + 1;
    }
  }

  // Convert column offset to A1 notation
  const colLetter = (n: number): string => {
    let result = "";
    while (n >= 0) {
      result = String.fromCharCode((n % 26) + 65) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  };

  const startCol = colLetter(colOffset);
  const endCol = colLetter(colOffset + 4);
  const range = `'${sheetName}'!${startCol}${targetRow + 1}:${endCol}${targetRow + 1}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [[meal.description, meal.calories, meal.fat, meal.carbs, meal.protein]],
    },
  });
}

// Update the totals row for a specific day
export async function updateDayTotals(date: Date): Promise<void> {
  const weekData = await getCurrentWeekData(date);
  const dayIndex = date.getDay();
  const day = weekData.days[dayIndex];

  const sheetName = await ensureWeekSheet(date);
  const sheets = getSheets();
  const colOffset = dayIndex * 5;

  // Find the row after the last meal
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:AI50`,
  });

  const rows = result.data.values || [];
  let lastMealRow = 6;
  for (let row = 6; row < rows.length; row++) {
    const cell = rows[row]?.[colOffset];
    if (cell && cell !== "" && !cell.toLowerCase().startsWith("total")) {
      lastMealRow = row;
    }
  }

  const colLetter = (n: number): string => {
    let r = "";
    while (n >= 0) {
      r = String.fromCharCode((n % 26) + 65) + r;
      n = Math.floor(n / 26) - 1;
    }
    return r;
  };

  const totalRow = lastMealRow + 2; // Leave a gap
  const startCol = colLetter(colOffset);
  const endCol = colLetter(colOffset + 4);
  const range = `'${sheetName}'!${startCol}${totalRow + 1}:${endCol}${totalRow + 1}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "Total",
          day.totals.calories,
          day.totals.fat,
          day.totals.carbs,
          day.totals.protein,
        ],
      ],
    },
  });
}
