const PolicyFinder = require("../utils/policyFinder");
const policyData = require("../data/policies.json");

if (!policyData || !Array.isArray(policyData.data)) {
 throw new Error("Invalid or missing policy data in policies.json");
}

const policyFinder = new PolicyFinder(policyData);

module.exports = {
 getPolicyUrl: (search) => {
  console.log(`Searching policy for: "${search}"`);
  if (!search) return { status: "error", message: "Search term is required" };
  const result = policyFinder.getPolicyUrl(search);
  console.log(`Policy search result:`, result);
  return result;
 },
 getPolicyDetails: (search) => {
  if (!search) return { status: "error", message: "Search term is required" };
  return policyFinder.getPolicyDetails(search);
 },
 getPolicyById: (id) => {
  if (!id) return { status: "error", message: "Policy ID is required" };
  return policyFinder.getPolicyById(id);
 },
};
