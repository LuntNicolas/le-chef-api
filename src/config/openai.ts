import "dotenv/config";
import {OpenAI} from "openai";

const openAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
});

export default openAI;