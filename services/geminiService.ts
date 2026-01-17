
import { GoogleGenAI, Type } from "@google/genai";
import { Site, TowerType, Sector } from "../types";
import { ANTENNA_LIBRARY } from "../constants";

/**
 * OFFLINE ENGINEERING CORE
 * This module provides logical reasoning for RF parameters
 * and handles Chat interaction via Gemini API if available.
 */

export const getRFAdvice = async (sites: Site[], query: string): Promise<string> => {
  const normalizedQuery = query.toLowerCase();
  
  // Try to use Gemini for conversational advice if an API key is present
  if (process.env.API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `User is asking about an RF project with ${sites.length} sites. Query: "${query}"`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert RF network planning advisor. Provide technical, professional advice based on project data."
        }
      });
      return response.text || "Engineering core returned an empty response.";
    } catch (e) {
      console.warn("Gemini Advice failed, falling back to local logic.");
    }
  }

  // Local deterministic logic fallback
  await new Promise(resolve => setTimeout(resolve, 400));

  const totalSectors = sites.reduce((acc, s) => acc + s.sectors.length, 0);
  const highTiltSectors = sites.flatMap(s => s.sectors).filter(sec => (sec.mechanicalTilt + sec.electricalTilt) > 8);

  let response = `### Engineering Core Output [Local Engine]\n\n`;

  if (normalizedQuery.includes('tilt')) {
    response += `**Tilt Report:** ${highTiltSectors.length} sectors have aggressive downtilt. Consider electrical tilt optimization to reduce side-lobe interference.\n`;
  } else if (normalizedQuery.includes('interference')) {
    response += `**Interference Report:** System suggests frequency reuse planning (K=3) to minimize co-channel overlaps in dense areas.\n`;
  } else {
    response += `Advice: Focus on filling coverage holes in low RSRP areas. Your project currently has ${sites.length} sites active. Try the 'Smart Expansion Tool' (Target icon) to find optimal node placements.\n`;
  }

  return response;
};
