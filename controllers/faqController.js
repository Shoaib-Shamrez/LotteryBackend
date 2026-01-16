import {
  getAllFaqs,
  getFaqById,
  createFaq,
  deleteFaq,
} from "../models/faqModel.js";

export const getFaqs = async (req, res) => {
  try {
    const faqs = await getAllFaqs();
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFaq = async (req, res) => {
  try {
    const faq = await getFaqById(req.params.id);
    if (!faq) return res.status(404).json({ message: "FAQ not found" });
    res.json(faq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addFaq = async (req, res) => {
  const { question, answer } = req.body;
  try {
    const newFaq = await createFaq(question, answer);
    res.status(201).json(newFaq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeFaq = async (req, res) => {
  try {
    await deleteFaq(req.params.id);
    res.json({ message: "FAQ deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
