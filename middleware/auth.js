const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

// Authenticate requests using Bearer JWT and attach user to req
module.exports = async function (req, res, next) {
	try {
		const authHeader = req.headers["authorization"] || req.headers["Authorization"];
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Authorization token missing" });
		}

		const token = authHeader.substring(7);
		let payload;
		try {
			payload = jwt.verify(token, config.JWT_SECRET);
		} catch (e) {
			return res.status(401).json({ error: "Invalid or expired token" });
		}

		const user = await User.findById(payload.id).lean();
		if (!user) {
			return res.status(401).json({ error: "User not found for token" });
		}

		req.user = { id: user._id.toString(), email: user.email, name: user.name };
		next();
	} catch (err) {
		console.error("Auth middleware error:", err);
		res.status(500).json({ error: "Auth processing failed" });
	}
};

