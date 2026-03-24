import { google } from "googleapis";

function getCredentials(): { client_email: string; private_key: string } {
  // Option 1: GOOGLE_CREDENTIALS contains the entire service account JSON (base64 encoded)
  if (process.env.GOOGLE_CREDENTIALS) {
    const json = Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  }

  // Option 2: Separate env vars
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  let privateKey: string;
  if (rawKey.startsWith("-----BEGIN")) {
    privateKey = rawKey.replace(/\\n/g, "\n").replace(/"/g, "");
  } else {
    privateKey = Buffer.from(rawKey, "base64").toString("utf-8");
  }

  return {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    private_key: privateKey,
  };
}

function getAuth() {
  const creds = getCredentials();
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

// Upload an image to Google Drive shared folder and return a viewable URL
export async function uploadImage(base64Data: string): Promise<string> {
  const drive = getDrive();

  // Strip data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const response = await drive.files.create({
    requestBody: {
      name: `progress_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined,
    },
    media: {
      mimeType: "image/jpeg",
      body: require("stream").Readable.from(buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  // Make it viewable by anyone with the link
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch {
    // Folder may already have public sharing set
  }

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

const DEFAULT_GOALS = {
  calories: Number(process.env.GOAL_CALORIES) || 2650,
  fat: Number(process.env.GOAL_FAT) || 85,
  carbs: Number(process.env.GOAL_CARBS) || 230,
  protein: Number(process.env.GOAL_PROTEIN) || 180,
};

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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Get current date in US Eastern time
function nowEastern(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(str);
}

// Get the sheet name for a given week (using the Sunday date)
function getWeekSheetName(date: Date): string {
  // Find the Sunday of that week
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const month = MONTHS[d.getMonth()];
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
    String(DEFAULT_GOALS.calories),
    String(DEFAULT_GOALS.fat),
    String(DEFAULT_GOALS.carbs),
    String(DEFAULT_GOALS.protein),
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
  const targetDate = date || nowEastern();
  const sheetName = await ensureWeekSheet(targetDate);
  const sheets = getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:AI50`,
  });

  const rows = result.data.values || [];
  const goals = {
    calories: Number(rows[1]?.[6]) || DEFAULT_GOALS.calories,
    fat: Number(rows[1]?.[7]) || DEFAULT_GOALS.fat,
    carbs: Number(rows[1]?.[8]) || DEFAULT_GOALS.carbs,
    protein: Number(rows[1]?.[9]) || DEFAULT_GOALS.protein,
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

// Get yearly summary - averages per week for the calendar year
export interface WeekSummary {
  weekStart: string;
  averages: { calories: number; fat: number; carbs: number; protein: number };
  daysLogged: number;
}

export async function getYearlySummary(): Promise<{ weeks: WeekSummary[]; goals: { calories: number; fat: number; carbs: number; protein: number } }> {
  const sheets = getSheets();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const now = nowEastern();
  const currentYear = now.getFullYear();
  const allTabs = spreadsheet.data.sheets?.map((s) => s.properties?.title || "") || [];

  // Filter tabs that match our week naming pattern for the current year
  const weekTabs = allTabs.filter((name) => {
    const parts = name.split(" ");
    if (parts.length !== 3) return false;
    const year = parseInt(parts[2]);
    return year === currentYear && MONTHS.includes(parts[0]);
  });

  // Sort by date
  weekTabs.sort((a, b) => {
    const pa = a.split(" ");
    const pb = b.split(" ");
    const ma = MONTHS.indexOf(pa[0]);
    const mb = MONTHS.indexOf(pb[0]);
    if (ma !== mb) return ma - mb;
    return parseInt(pa[1]) - parseInt(pb[1]);
  });

  const weeks: WeekSummary[] = [];
  let goals = DEFAULT_GOALS;

  for (const tab of weekTabs) {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${tab}'!A1:AI50`,
    });

    const rows = result.data.values || [];

    // Read goals from this tab
    goals = {
      calories: Number(rows[1]?.[6]) || DEFAULT_GOALS.calories,
      fat: Number(rows[1]?.[7]) || DEFAULT_GOALS.fat,
      carbs: Number(rows[1]?.[8]) || DEFAULT_GOALS.carbs,
      protein: Number(rows[1]?.[9]) || DEFAULT_GOALS.protein,
    };

    let totalCal = 0, totalFat = 0, totalCarbs = 0, totalProtein = 0;
    let daysLogged = 0;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const colOffset = dayIndex * 5;
      let dayCal = 0;
      let hasMeals = false;

      for (let row = 6; row < rows.length; row++) {
        const desc = rows[row]?.[colOffset];
        if (!desc || desc === "" || desc.toLowerCase().startsWith("total")) continue;
        hasMeals = true;
        dayCal += Number(rows[row]?.[colOffset + 1]) || 0;
        totalFat += Number(rows[row]?.[colOffset + 2]) || 0;
        totalCarbs += Number(rows[row]?.[colOffset + 3]) || 0;
        totalProtein += Number(rows[row]?.[colOffset + 4]) || 0;
      }

      if (hasMeals) {
        totalCal += dayCal;
        daysLogged++;
      }
    }

    if (daysLogged > 0) {
      weeks.push({
        weekStart: tab,
        averages: {
          calories: Math.round(totalCal / daysLogged),
          fat: Math.round(totalFat / daysLogged),
          carbs: Math.round(totalCarbs / daysLogged),
          protein: Math.round(totalProtein / daysLogged),
        },
        daysLogged,
      });
    }
  }

  return { weeks, goals };
}

// --- Custom prompt stored in "Prompt" tab ---

async function ensurePromptSheet(): Promise<string> {
  const sheets = getSheets();
  const sheetName = "Prompt";

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
    requestBody: { values: [["Paste your custom system prompt below this row. Leave empty to use the default."]] },
  });

  return sheetName;
}

export async function getCustomPrompt(): Promise<string | null> {
  const sheetName = await ensurePromptSheet();
  const sheets = getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:A200`,
  });

  const rows = result.data.values || [];
  const lines = rows.map((r) => r[0] || "").join("\n").trim();
  return lines || null;
}

// --- Progress tracking (weight + photos) stored in "Progress" tab ---

export interface ProgressEntry {
  date: string;
  time: string;
  weight: number | null;
  photo: string | null; // base64 thumbnail
  note: string;
}

async function ensureProgressSheet(): Promise<string> {
  const sheets = getSheets();
  const sheetName = "Progress";

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
    range: `'${sheetName}'!A1:E1`,
    valueInputOption: "RAW",
    requestBody: { values: [["Date", "Time", "Weight", "Photo", "Note"]] },
  });

  return sheetName;
}

export async function getProgress(): Promise<ProgressEntry[]> {
  const sheetName = await ensureProgressSheet();
  const sheets = getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:E500`,
  });

  const rows = result.data.values || [];
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      date: r[0] || "",
      time: r[1] || "",
      weight: r[2] ? Number(r[2]) : null,
      photo: r[3] || null,
      note: r[4] || "",
    }));
}

export async function addProgress(entry: ProgressEntry): Promise<void> {
  const sheetName = await ensureProgressSheet();
  const sheets = getSheets();

  // Upload photo to Google Drive if available, store URL in sheet
  let photoValue = entry.photo || "";
  if (photoValue && photoValue.startsWith("data:") && DRIVE_FOLDER_ID) {
    photoValue = await uploadImage(photoValue);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A:E`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[entry.date, entry.time, entry.weight || "", photoValue, entry.note]],
    },
  });
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

// Remove a meal from a specific day by matching description
export async function removeMeal(
  date: Date,
  description: string
): Promise<boolean> {
  const sheetName = await ensureWeekSheet(date);
  const sheets = getSheets();
  const dayIndex = date.getDay();
  const colOffset = dayIndex * 5;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:AI50`,
  });

  const rows = result.data.values || [];
  const descLower = description.toLowerCase();

  // Find the row with the closest matching description
  let matchRow = -1;
  for (let row = 6; row < rows.length; row++) {
    const cell = rows[row]?.[colOffset];
    if (cell && cell.toLowerCase().includes(descLower) || (cell && descLower.includes(cell.toLowerCase()))) {
      matchRow = row;
      break;
    }
  }

  if (matchRow === -1) return false;

  const colLetter = (n: number): string => {
    let r = "";
    while (n >= 0) {
      r = String.fromCharCode((n % 26) + 65) + r;
      n = Math.floor(n / 26) - 1;
    }
    return r;
  };

  const startCol = colLetter(colOffset);
  const endCol = colLetter(colOffset + 4);
  const range = `'${sheetName}'!${startCol}${matchRow + 1}:${endCol}${matchRow + 1}`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range,
  });

  return true;
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
