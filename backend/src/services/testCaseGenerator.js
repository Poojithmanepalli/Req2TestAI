// Rule-based fallback test cases — domain-agnostic
// Only used when AI test case generation fails for a requirement
function generateTestCases(text) {
  const t = text.toLowerCase();

  // Identify the nature of the requirement and return appropriate generic tests

  // Access / Auth related
  if (
    t.includes("login") || t.includes("log in") || t.includes("credential") ||
    t.includes("authentication") || t.includes("sign up") || t.includes("register")
  ) {
    return [
      { title: "Valid Credentials", steps: ["Provide valid credentials", "Submit"], expected: "Access granted successfully" },
      { title: "Invalid Credentials", steps: ["Provide incorrect credentials", "Submit"], expected: "Access denied with error message" },
      { title: "Empty Input", steps: ["Leave required fields empty", "Submit"], expected: "Validation error displayed" },
      { title: "Unauthorized Access", steps: ["Attempt access without credentials"], expected: "System redirects to login or denies access" }
    ];
  }

  // Data input / Create / Update / Delete
  if (
    t.includes("create") || t.includes("add") || t.includes("submit") ||
    t.includes("update") || t.includes("edit") || t.includes("delete") ||
    t.includes("modify") || t.includes("enter") || t.includes("input") ||
    t.includes("save") || t.includes("record")
  ) {
    return [
      { title: "Valid Input", steps: ["Provide all required valid data", "Submit"], expected: "Operation completes successfully, data persisted" },
      { title: "Missing Required Fields", steps: ["Leave required fields empty", "Submit"], expected: "Validation error shown for each missing field" },
      { title: "Invalid Data Format", steps: ["Enter data in wrong format", "Submit"], expected: "Appropriate format error displayed" },
      { title: "Boundary Values", steps: ["Enter minimum and maximum allowed values", "Submit"], expected: "System accepts boundary values correctly" }
    ];
  }

  // Read / Display / Search / View
  if (
    t.includes("display") || t.includes("view") || t.includes("show") ||
    t.includes("list") || t.includes("search") || t.includes("filter") ||
    t.includes("retrieve") || t.includes("fetch") || t.includes("query")
  ) {
    return [
      { title: "Correct Data Display", steps: ["Navigate to the relevant screen"], expected: "Accurate and up-to-date data displayed" },
      { title: "Empty State", steps: ["Access when no data exists"], expected: "Appropriate empty state message shown" },
      { title: "Search / Filter", steps: ["Apply search or filter criteria"], expected: "Only matching results returned" },
      { title: "Unauthorized View", steps: ["Attempt to view data without proper role"], expected: "Access denied or data hidden" }
    ];
  }

  // Notifications / Alerts / Events
  if (
    t.includes("notification") || t.includes("alert") || t.includes("notify") ||
    t.includes("trigger") || t.includes("event") || t.includes("reminder") ||
    t.includes("broadcast") || t.includes("message")
  ) {
    return [
      { title: "Trigger Condition Met", steps: ["Perform action that triggers notification"], expected: "Notification sent correctly to intended recipients" },
      { title: "Trigger Condition Not Met", steps: ["Ensure trigger condition is not met"], expected: "No notification sent" },
      { title: "Duplicate Prevention", steps: ["Trigger same condition multiple times rapidly"], expected: "No duplicate notifications generated" },
      { title: "Delivery Confirmation", steps: ["Trigger and check recipient"], expected: "Notification received at correct destination" }
    ];
  }

  // Performance / Load / Concurrency
  if (
    t.includes("concurrent") || t.includes("response time") || t.includes("latency") ||
    t.includes("throughput") || t.includes("load") || t.includes("uptime") ||
    t.includes("performance") || t.includes("scalab") || t.includes("availability")
  ) {
    return [
      { title: "Normal Load", steps: ["Run system under normal usage"], expected: "Performance meets specified requirements" },
      { title: "Peak Load", steps: ["Simulate maximum concurrent users or requests"], expected: "System remains stable without degradation" },
      { title: "Stress Test", steps: ["Exceed expected load limits"], expected: "System degrades gracefully without crashing" },
      { title: "Recovery", steps: ["Remove load after stress test"], expected: "System recovers to normal performance" }
    ];
  }

  // Security / Encryption / Compliance
  if (
    t.includes("encrypt") || t.includes("secure") || t.includes("compliance") ||
    t.includes("privacy") || t.includes("access control") || t.includes("rbac") ||
    t.includes("permission") || t.includes("vulnerability") || t.includes("gdpr") ||
    t.includes("audit") || t.includes("https") || t.includes("tls")
  ) {
    return [
      { title: "Authorized Access", steps: ["Access with correct role/permission"], expected: "Access granted, data visible" },
      { title: "Unauthorized Access", steps: ["Access with insufficient role/permission"], expected: "Access denied, no data leaked" },
      { title: "Data Protection", steps: ["Inspect stored or transmitted data"], expected: "Data is encrypted / compliant with standard" },
      { title: "Audit Trail", steps: ["Perform a sensitive operation"], expected: "Action logged in audit trail" }
    ];
  }

  // File / Data Management / Backup
  if (
    t.includes("upload") || t.includes("download") || t.includes("file") ||
    t.includes("backup") || t.includes("restore") || t.includes("import") ||
    t.includes("export") || t.includes("storage") || t.includes("recover")
  ) {
    return [
      { title: "Valid File Operation", steps: ["Perform file upload/download/import/export with valid file"], expected: "Operation succeeds, data intact" },
      { title: "Invalid File Type", steps: ["Use unsupported file format"], expected: "Error message displayed, operation rejected" },
      { title: "File Size Limit", steps: ["Upload file exceeding size limit"], expected: "System rejects with size limit message" },
      { title: "Recovery", steps: ["Simulate failure during operation", "Restore from backup"], expected: "Data recoverable without loss" }
    ];
  }

  // Generic fallback — covers any other requirement type
  return [
    { title: "Happy Path", steps: ["Provide valid inputs", "Execute the feature as intended"], expected: "System performs as specified in requirement" },
    { title: "Invalid Input Handling", steps: ["Provide invalid or unexpected input"], expected: "System handles gracefully with appropriate error" },
    { title: "Boundary Condition", steps: ["Test with minimum and maximum allowed values"], expected: "System behaves correctly at boundaries" },
    { title: "Unauthorized Action", steps: ["Attempt action without required permissions"], expected: "System denies access or shows appropriate restriction" }
  ];
}

module.exports = { generateTestCases };
