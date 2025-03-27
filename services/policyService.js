const PolicyFinder = require("../utils/policyFinder");
const policyData = require("../data/policies.json");

const policyFinder = new PolicyFinder(policyData);

module.exports = {
 getPolicyUrl: (search) => policyFinder.getPolicyUrl(search),
 getPolicyDetails: (search) => policyFinder.getPolicyDetails(search),
 getPolicyById: (id) => policyFinder.getPolicyById(id),
};
