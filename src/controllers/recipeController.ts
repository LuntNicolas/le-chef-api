import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {getFridgeItems} from "../utils/getFridgeItems.ts";
import openAI from "../config/openai.ts";

export const getRecipe = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    try {
        const fridgeItems = await getFridgeItems(userId);
        const response = await openAI.responses.create({
            model: "gpt-5.4-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Du bist ein Küchenchef. Dir stehen folgende Zutaten im Kühlschrank zur Verfügung:

${fridgeItems?.map((item) => `- ${item.name} (${item.quantity} ${item.unit})`).join("\n")}

Erstelle genau 3 Rezeptvorschläge basierend auf diesen Zutaten.

Antworte NUR mit einem JSON-Array ohne Markdown-Codeblock oder sonstige Erklärungen:
[
  {
    "title": "Rezeptname",
    "usedItems": ["Zutat1", "Zutat2"],
    "steps": [
      "Schritt 1: ...",
      "Schritt 2: ..."
    ],
    "duration": 30
  }
]`
                        }
                    ]
                }
            ]
        })
        const raw = response.output_text ?? "";
        const items = JSON.parse(raw);
        console.log(items);
        res.status(200).send(items);

    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}