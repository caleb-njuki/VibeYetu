// The help desk. The server answers (AI when it is set up, ready answers otherwise).
import { post } from "./http.js";

export async function getReply(question, lang = "en", history = []) {
  try {
    const res = await post("/assistant", { message: question.slice(0, 500), lang, history: history.slice(-4) }, "buyer");
    return res.reply;
  } catch (err) {
    return err.message || (lang === "sw" ? "Samahani, kuna tatizo. Jaribu tena baadaye." : "Sorry, something went wrong. Please try again in a moment.");
  }
}
