"use client";

import { WeekData } from "@/lib/sheets";

function MacroBar({
  value,
  goal,
  color,
}: {
  value: number;
  goal: number;
  color: string;
}) {
  const pct = Math.min((value / goal) * 100, 120);
  const over = value > goal;
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-0.5">
      <div
        className={`h-1.5 rounded-full ${over ? "bg-red-400" : color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function WeekTable({ data }: { data: WeekData | null }) {
  if (!data) {
    return (
      <div className="text-gray-500 text-center py-8">Loading week data...</div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-3">
      {/* Goals & Averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Goals</div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Cal</span>{" "}
              <span className="font-medium">{data.goals.calories}</span>
            </div>
            <div>
              <span className="text-gray-400">F</span>{" "}
              <span className="font-medium">{data.goals.fat}g</span>
            </div>
            <div>
              <span className="text-gray-400">C</span>{" "}
              <span className="font-medium">{data.goals.carbs}g</span>
            </div>
            <div>
              <span className="text-gray-400">P</span>{" "}
              <span className="font-medium">{data.goals.protein}g</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Week Average
          </div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <span className={data.averages.calories > data.goals.calories ? "text-red-400" : "text-green-400"}>
                {data.averages.calories}
              </span>
            </div>
            <div>
              <span className={data.averages.fat > data.goals.fat ? "text-red-400" : "text-green-400"}>
                {data.averages.fat}g
              </span>
            </div>
            <div>
              <span className={data.averages.carbs > data.goals.carbs ? "text-red-400" : "text-green-400"}>
                {data.averages.carbs}g
              </span>
            </div>
            <div>
              <span className={data.averages.protein > data.goals.protein ? "text-green-400" : "text-yellow-400"}>
                {data.averages.protein}g
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {data.days.map((day) => {
          const isToday = day.date === today;
          return (
            <div
              key={day.date}
              className={`bg-gray-900 rounded-lg p-3 ${
                isToday ? "ring-1 ring-blue-500" : ""
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-sm">
                  {day.dayLabel}
                  {isToday && (
                    <span className="ml-2 text-xs text-blue-400">TODAY</span>
                  )}
                </div>
                {day.meals.length > 0 && (
                  <div className="text-xs text-gray-400">
                    {day.totals.calories} cal
                  </div>
                )}
              </div>

              {day.meals.length > 0 ? (
                <>
                  <div className="space-y-1 mb-2">
                    {day.meals.map((meal, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-gray-300"
                      >
                        <span className="truncate mr-2">{meal.description}</span>
                        <span className="text-gray-500 whitespace-nowrap">
                          {meal.calories} / {meal.fat}f / {meal.carbs}c /{" "}
                          {meal.protein}p
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-800 pt-2 grid grid-cols-4 gap-1">
                    <div>
                      <div className="text-xs text-gray-500">Cal</div>
                      <div className="text-sm font-medium">{day.totals.calories}</div>
                      <MacroBar
                        value={day.totals.calories}
                        goal={data.goals.calories}
                        color="bg-blue-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Fat</div>
                      <div className="text-sm font-medium">{day.totals.fat}g</div>
                      <MacroBar
                        value={day.totals.fat}
                        goal={data.goals.fat}
                        color="bg-yellow-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="text-sm font-medium">{day.totals.carbs}g</div>
                      <MacroBar
                        value={day.totals.carbs}
                        goal={data.goals.carbs}
                        color="bg-green-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Protein</div>
                      <div className="text-sm font-medium">{day.totals.protein}g</div>
                      <MacroBar
                        value={day.totals.protein}
                        goal={data.goals.protein}
                        color="bg-purple-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-600">No meals logged</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
