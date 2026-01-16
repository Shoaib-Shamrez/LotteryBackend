// controllers/subscriberController.js
import {
  addSubscriber,
  getSubscriberByEmail,
  getAllSubscribers,
} from "../models/subscriberModel.js";

// Simple email regex for validation
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// POST /api/subscribers/subscribe
export const subscribeUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address" });
    }

    const existing = await getSubscriberByEmail(email);
    if (existing) {
      return res
        .status(200)
        .json({ success: false, message: "Already subscribed" });
    }

    await addSubscriber(name, email);
    return res
      .status(201)
      .json({ success: true, message: "Subscription successful" });
  } catch (error) {
    console.error("Subscribe Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error, please try again later",
      });
  }
};

// GET /api/subscribers (optional for admin)
export const fetchAllSubscribers = async (req, res) => {
  try {
    const data = await getAllSubscribers();
    res.status(200).json({ success: true, subscribers: data });
  } catch (error) {
    console.error("Fetch Subscribers Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
