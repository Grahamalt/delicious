"use client";

import { useState, useEffect, useCallback } from "react";

interface Recipe {
  id: number;
  name: string;
  notes: string;
}

interface Ingredient {
  id: number;
  recipe_id: number;
  name: string;
  grams: number;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  sort_order: number;
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/recipes");
    if (res.ok) {
      const data = await res.json();
      setRecipes(data.recipes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const createRecipe = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewName("");
      setAdding(false);
      await loadRecipes();
      setSelected(data.recipe);
    }
  };

  const deleteRecipe = async (id: number) => {
    if (!confirm("Delete this recipe and all of its ingredients?")) return;
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    setSelected(null);
    await loadRecipes();
  };

  if (selected) {
    return (
      <RecipeDetail
        recipe={selected}
        onBack={() => {
          setSelected(null);
          loadRecipes();
        }}
        onDelete={() => deleteRecipe(selected.id)}
      />
    );
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Recipes</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            + New recipe
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Recipe name"
            autoFocus
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") createRecipe();
              if (e.key === "Escape") {
                setAdding(false);
                setNewName("");
              }
            }}
          />
          <button
            onClick={createRecipe}
            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
          >
            Create
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="text-gray-600 text-sm italic">No recipes yet.</div>
      ) : (
        <ul className="space-y-1">
          {recipes.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r)}
                className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-750 hover:bg-gray-700 text-sm"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipeDetail({
  recipe,
  onBack,
  onDelete,
}: {
  recipe: Recipe;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(recipe.name);
  const [notes, setNotes] = useState(recipe.notes);
  const [newIngName, setNewIngName] = useState("");
  const [newIngGrams, setNewIngGrams] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/recipes/${recipe.id}`);
    if (res.ok) {
      const data = await res.json();
      setIngredients(data.ingredients);
      setName(data.recipe.name);
      setNotes(data.recipe.notes);
    }
    setLoading(false);
  }, [recipe.id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + Number(i.calories),
      fat: acc.fat + Number(i.fat),
      carbs: acc.carbs + Number(i.carbs),
      protein: acc.protein + Number(i.protein),
      grams: acc.grams + Number(i.grams),
    }),
    { calories: 0, fat: 0, carbs: 0, protein: 0, grams: 0 }
  );

  const addIngredient = async (estimate: boolean) => {
    const nm = newIngName.trim();
    const g = Number(newIngGrams);
    if (!nm || !g) return;

    let macros = { calories: 0, fat: 0, carbs: 0, protein: 0 };
    if (estimate) {
      setEstimating(true);
      try {
        const r = await fetch("/api/ingredients/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nm, grams: g }),
        });
        if (r.ok) {
          const data = await r.json();
          macros = data.macros;
        }
      } finally {
        setEstimating(false);
      }
    }

    const res = await fetch(`/api/recipes/${recipe.id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nm,
        grams: g,
        ...macros,
        sort_order: ingredients.length,
      }),
    });
    if (res.ok) {
      setNewIngName("");
      setNewIngGrams("");
      await load();
    }
  };

  const updateField = async (id: number, field: string, value: string) => {
    const num = field === "name" ? value : Number(value) || 0;
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: num } : i))
    );
    await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: num }),
    });
  };

  const reEstimate = async (ing: Ingredient) => {
    setEstimating(true);
    try {
      const r = await fetch("/api/ingredients/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ing.name, grams: ing.grams }),
      });
      if (r.ok) {
        const data = await r.json();
        await fetch(`/api/ingredients/${ing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.macros),
        });
        await load();
      }
    } finally {
      setEstimating(false);
    }
  };

  const removeIngredient = async (id: number) => {
    await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
    await load();
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notes }),
      });
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          aria-label="Back"
        >
          ← Back
        </button>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 ml-auto"
        >
          Delete
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveMeta}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-base font-semibold"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveMeta}
        placeholder="Notes / directions..."
        rows={2}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
      />
      {savingMeta && <div className="text-gray-500 text-xs">Saving…</div>}

      <div className="rounded bg-gray-800 border border-gray-700 p-2 text-xs">
        <div className="font-semibold mb-1">Totals</div>
        <div className="grid grid-cols-5 gap-1 text-gray-300">
          <div>{Math.round(totals.grams)}g</div>
          <div>{Math.round(totals.calories)} cal</div>
          <div>{Math.round(totals.fat)}f</div>
          <div>{Math.round(totals.carbs)}c</div>
          <div>{Math.round(totals.protein)}p</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Ingredients</div>

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : ingredients.length === 0 ? (
          <div className="text-gray-600 text-xs italic">No ingredients yet.</div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-1 text-[10px] text-gray-500 px-1">
              <div className="col-span-4">Name</div>
              <div className="col-span-1 text-right">g</div>
              <div className="col-span-1 text-right">cal</div>
              <div className="col-span-1 text-right">f</div>
              <div className="col-span-1 text-right">c</div>
              <div className="col-span-1 text-right">p</div>
              <div className="col-span-3"></div>
            </div>
            {ingredients.map((i) => (
              <div
                key={i.id}
                className="grid grid-cols-12 gap-1 items-center text-xs"
              >
                <input
                  value={i.name}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) => (x.id === i.id ? { ...x, name: e.target.value } : x))
                    )
                  }
                  onBlur={(e) => updateField(i.id, "name", e.target.value)}
                  className="col-span-4 bg-gray-800 border border-gray-700 rounded px-1 py-0.5"
                />
                <input
                  type="number"
                  value={i.grams}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, grams: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                  onBlur={(e) => updateField(i.id, "grams", e.target.value)}
                  className="col-span-1 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-right"
                />
                <input
                  type="number"
                  value={i.calories}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, calories: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                  onBlur={(e) => updateField(i.id, "calories", e.target.value)}
                  className="col-span-1 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-right"
                />
                <input
                  type="number"
                  value={i.fat}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, fat: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                  onBlur={(e) => updateField(i.id, "fat", e.target.value)}
                  className="col-span-1 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-right"
                />
                <input
                  type="number"
                  value={i.carbs}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, carbs: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                  onBlur={(e) => updateField(i.id, "carbs", e.target.value)}
                  className="col-span-1 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-right"
                />
                <input
                  type="number"
                  value={i.protein}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, protein: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                  onBlur={(e) => updateField(i.id, "protein", e.target.value)}
                  className="col-span-1 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-right"
                />
                <div className="col-span-3 flex gap-1 justify-end">
                  <button
                    onClick={() => reEstimate(i)}
                    disabled={estimating}
                    className="px-1.5 py-0.5 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-[10px]"
                    title="Re-estimate macros"
                  >
                    AI
                  </button>
                  <button
                    onClick={() => removeIngredient(i.id)}
                    className="px-1.5 py-0.5 rounded bg-red-700 hover:bg-red-600 text-[10px]"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-800 space-y-2">
          <div className="text-xs font-semibold text-gray-400">Add ingredient</div>
          <div className="flex gap-1">
            <input
              value={newIngName}
              onChange={(e) => setNewIngName(e.target.value)}
              placeholder="e.g. chicken breast"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            />
            <input
              type="number"
              value={newIngGrams}
              onChange={(e) => setNewIngGrams(e.target.value)}
              placeholder="grams"
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addIngredient(true)}
              disabled={estimating || !newIngName.trim() || !newIngGrams}
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            >
              {estimating ? "Estimating…" : "Add + estimate macros"}
            </button>
            <button
              onClick={() => addIngredient(false)}
              disabled={!newIngName.trim() || !newIngGrams}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            >
              Add empty
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
