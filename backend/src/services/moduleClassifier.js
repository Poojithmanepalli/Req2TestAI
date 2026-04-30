function classifyModule(text) {
  const t = text.toLowerCase();

  // Security & Compliance — checked FIRST so encryption/compliance requirements
  // are not pulled into Authentication just because they mention "password" or "authentication"
  if (
    t.includes("encrypt") || t.includes("aes") || t.includes("bcrypt") ||
    t.includes("pbkdf2") || t.includes("https") || t.includes("tls") ||
    t.includes("ssl") || t.includes("gdpr") || t.includes("penetration") ||
    t.includes("vulnerability") || t.includes("data protection") ||
    t.includes("data security") || t.includes("security policy") ||
    t.includes("compliance") || t.includes("privacy") || t.includes("audit") ||
    t.includes("rbac") || t.includes("role-based access") ||
    t.includes("access control") || t.includes("access rights")
  ) {
    return "Security";
  }

  // Authentication — only when the requirement IS about login/registration flow
  if (
    t.includes("login") || t.includes("log in") || t.includes("log out") ||
    t.includes("logout") || t.includes("sign up") || t.includes("signup") ||
    t.includes("user registration") || t.includes("new account") ||
    t.includes("credential") || t.includes("jwt") || t.includes("oauth") ||
    t.includes("session expir") || t.includes("college email") ||
    t.includes("email id") || t.includes("roll number") ||
    t.includes("password reset") || t.includes("forgot password") ||
    t.includes("account recovery")
  ) {
    return "Authentication";
  }

  // Performance & Scalability — only actual performance metrics, NOT "real-time" features
  if (
    t.includes("concurrent") || t.includes("uptime") ||
    t.includes("response time") || t.includes("latency") ||
    t.includes("throughput") || t.includes("scalab") ||
    t.includes("peak usage") || t.includes("peak hours") ||
    t.includes("performance degradation") || t.includes("load balancing") ||
    t.includes("availability") || t.includes("99.") ||
    (t.includes("second") && (t.includes("within") || t.includes("under") || t.includes("less than")))
  ) {
    return "Performance";
  }

  // Notifications & Communication
  if (
    t.includes("notification") || t.includes("push notification") ||
    t.includes("broadcast") || t.includes("alert") ||
    t.includes("reminder") || t.includes("announcement") ||
    t.includes("sms") || t.includes("notify")
  ) {
    return "Notifications";
  }

  // Data Management — file operations, backups, imports/exports
  if (
    t.includes("upload") || t.includes("download") ||
    t.includes("file size") || t.includes("backup") ||
    t.includes("recover") || t.includes("restore") ||
    t.includes("disaster recovery") || t.includes("data loss") ||
    t.includes("import") || t.includes("export") ||
    t.includes("storage") || t.includes("archive") ||
    t.includes("timetable import") || t.includes("attachment")
  ) {
    return "Data Management";
  }

  // UI & Compatibility — platforms, browsers, accessibility standards
  if (
    t.includes("android") || t.includes("ios") ||
    t.includes("chrome") || t.includes("firefox") || t.includes("safari") ||
    t.includes("responsive") || t.includes("dark mode") || t.includes("light mode") ||
    t.includes("wcag") || t.includes("accessibility standard") ||
    t.includes("visually impaired") || t.includes("mobile platform") ||
    t.includes("web platform") || t.includes("browser compatible") ||
    t.includes("mobile-friendly") || t.includes("intuitive design")
  ) {
    return "UI & Compatibility";
  }

  // Dashboard & Reporting — admin monitoring, analytics, usage reports
  if (
    t.includes("dashboard") || t.includes("report") ||
    t.includes("analytics") || t.includes("statistics") ||
    t.includes("monitor") || t.includes("usage report") ||
    t.includes("insight") || t.includes("overview") ||
    t.includes("audit log") || t.includes("activity log")
  ) {
    return "Dashboard";
  }

  // General — everything not covered above
  return "General";
}

module.exports = { classifyModule };
