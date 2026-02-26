
import { GoogleGenAI, Type } from "@google/genai";
import { PrescriptionItem } from "./types";

/**
 * Analyse l'ordonnance avec Gemini-3-Pro pour une extraction précise des données médicales.
 * Utilise gemini-3-pro-preview pour les tâches complexes d'analyse d'images médicales.
 */
export const analyzePrescription = async (base64Image: string): Promise<{ items: PrescriptionItem[], isPsychotropic: boolean }> => {
  // Initialisation de GoogleGenAI à l'intérieur de la fonction pour garantir l'utilisation de la clé API la plus récente (process.env.API_KEY)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `Extrais TOUS les médicaments de cette image d'ordonnance. 
    Sois précis sur les noms, dosages et quantités.
    Identifie si un produit est un PSYCHOTROPE (réglementé) ou nécessite la CHAÎNE DU FROID.
    Retourne UNIQUEMENT un objet JSON pur suivant le schéma fourni.`;
    
    const imageData = base64Image.split(',')[1] || base64Image;

    // Utilisation de gemini-3-pro-preview pour les tâches de raisonnement complexes avec un budget de réflexion (thinkingBudget)
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData,
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        // Configuration de Thinking pour améliorer la précision de l'extraction des données médicales
        thinkingConfig: { thinkingBudget: 4096 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  isPsychotropic: { type: Type.BOOLEAN },
                  isColdChain: { type: Type.BOOLEAN }
                },
                required: ["name", "dosage", "quantity", "isPsychotropic"]
              }
            },
            isPsychotropic: { type: Type.BOOLEAN }
          },
          required: ["items", "isPsychotropic"]
        }
      }
    });

    // Accès direct à la propriété .text (pas de méthode .text()) avec gestion du cas undefined
    const responseText = response.text;
    let cleanText = responseText ? responseText.trim() : '';
    
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    }

    const result = JSON.parse(cleanText || '{"items": [], "isPsychotropic": false}');
    
    const sanitizedItems = (result.items || []).map((item: any) => ({
      ...item,
      status: 'PENDING'
    }));

    return {
      items: sanitizedItems,
      isPsychotropic: !!result.isPsychotropic
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      items: [],
      isPsychotropic: false
    };
  }
};
