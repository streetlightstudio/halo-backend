class PolicyFinder {
 constructor(policyData) {
  this.policyData = policyData;
 }

 findPolicyId(searchTerm) {
  const searchLower = searchTerm.toLowerCase().trim();
  const policy = this.policyData.data.find((p) => {
   const name = p.policyName.name?.toLowerCase() || "";
   const desc = p.policyName.desc?.toLowerCase() || "";
   const subCat = p.pSubId.name?.toLowerCase() || "";
   const matches =
    name === searchLower ||
    desc.includes(searchLower) ||
    subCat.includes(searchLower) ||
    name.split(" ").some((w) => w.startsWith(searchLower)) ||
    desc.split(" ").some((w) => w.startsWith(searchLower)) ||
    subCat.split(" ").some((w) => w.startsWith(searchLower));
   if (matches) {
    console.log(`Match found for "${searchLower}":`, { name, desc, subCat });
   }
   return matches;
  });
  if (!policy) {
   console.log(
    `No match for "${searchLower}" in:`,
    this.policyData.data.map((p) => p.policyName.name)
   );
  }
  return policy ? `https://healthematics.com/policies/4/6/${policy._id}` : null;
 }

 getPolicyUrl(searchTerm) {
  try {
   const url = this.findPolicyId(searchTerm);
   return url
    ? { status: "success", url, message: "Policy found" }
    : {
       status: "error",
       message: `No policy found for "${searchTerm}"`,
      };
  } catch (error) {
   return { status: "error", message: error.message };
  }
 }

 getPolicyDetails(searchTerm) {
  const searchLower = searchTerm.toLowerCase().trim();
  const policy = this.policyData.data.find((p) => {
   const name = p.policyName.name?.toLowerCase() || "";
   const desc = p.policyName.desc?.toLowerCase() || "";
   const subCat = p.pSubId.name?.toLowerCase() || "";
   return (
    name.includes(searchLower) ||
    desc.includes(searchLower) ||
    subCat.includes(searchLower) ||
    name.split(" ").some((w) => w.startsWith(searchLower)) ||
    desc.split(" ").some((w) => w.startsWith(searchLower)) ||
    subCat.split(" ").some((w) => w.startsWith(searchLower))
   );
  });
  if (!policy) return { status: "error", message: "No policy found" };
  return {
   status: "success",
   policy: {
    name: policy.policyName.name,
    description: policy.policyName.desc,
    category: policy.pCategoryId.name,
    subcategory: policy.pSubId.name,
    url: `http://localhost:${process.env.PORT || 3001}/policies/4/6/${
     policy._id
    }`,
    created: new Date(policy.policyName.createdAt).toLocaleDateString(),
   },
  };
 }

 getPolicyById(policyId) {
  const policy = this.policyData.data.find((p) => p._id === policyId);
  return policy
   ? { status: "success", policy }
   : { status: "error", message: "Policy not found" };
 }
}

module.exports = PolicyFinder;
