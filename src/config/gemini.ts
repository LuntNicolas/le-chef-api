import 'dotenv/config';
import {GoogleGenAI} from "@google/genai";

const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});

export default genAI;