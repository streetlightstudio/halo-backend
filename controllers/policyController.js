const {
 getPolicyUrl,
 getPolicyDetails,
 getPolicyById,
} = require("../services/policyService");

// Handler for getting a policy URL by search term
const getPolicy = async (req, res) => {
 const { search } = req.query;
 if (!search) {
  return res.status(400).json({ error: "Search term required" });
 }
 try {
  const result = await getPolicyUrl(search);
  res.json(result);
 } catch (error) {
  res.status(500).json({ error: "Failed to fetch policy URL" });
 }
};

// Handler for getting detailed policy information by search term
const fetchPolicyDetails = async (req, res) => {
 const { search } = req.query;
 if (!search) {
  return res.status(400).json({ error: "Search term required" });
 }
 try {
  const result = await getPolicyDetails(search);
  res.json(result);
 } catch (error) {
  res.status(500).json({ error: "Failed to fetch policy details" });
 }
};

// Handler for getting a policy by specific ID
const fetchPolicyById = async (req, res) => {
 try {
  const result = await getPolicyById(req.params.id);
  res.status(result.status === "success" ? 200 : 404).json(result);
 } catch (error) {
  res.status(500).json({ error: "Failed to fetch policy by ID" });
 }
};

module.exports = { getPolicy, fetchPolicyDetails, fetchPolicyById };
