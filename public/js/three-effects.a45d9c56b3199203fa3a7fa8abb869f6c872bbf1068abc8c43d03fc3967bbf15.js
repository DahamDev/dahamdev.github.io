// ===== INTERACTIVE TERMINAL SHELL =====
(function () {
  var PROMPT = "daham@live-server:~/portfolio$ ";

  // ===== FILE SYSTEM =====
  var files = {
    "about.txt": [
      "╔════════════════════════════════════════════╗",
      "║           Daham Navinda                    ║",
      "║       DevOps / Cloud Engineer              ║",
      "║    AWS & Kubernetes Specialist             ║",
      "╚════════════════════════════════════════════╝",
      "",
      "I'm a DevOps/Cloud Engineer with a strong",
      "background in building and managing cloud",
      "infrastructure at scale.",
      "",
      "Currently working at Amazon Web Services",
      "as a Cloud Support Engineer specializing",
      "in Kubernetes and container services.",
      "",
      "My expertise spans container orchestration",
      "with Kubernetes, AWS cloud services,",
      "infrastructure as code, and implementing",
      "DevOps best practices.",
      "",
      "  Email    : navindabc@gmail.com",
      "  GitHub   : github.com/DahamDev",
      "  LinkedIn : linkedin.com/in/dahamne",
    ],

    "experience.txt": [
      "┌──────────────────────────────────────────┐",
      "│          WORK EXPERIENCE                  │",
      "└──────────────────────────────────────────┘",
      "",
      "► Cloud Support Engineer",
      "  Amazon Web Services | 2024 – Present",
      "  Help organizations deploy and manage",
      "  containerized workloads on AWS cloud,",
      "  mainly on EKS and ECS. Investigate",
      "  critical production issues.",
      "",
      "► Senior Software Engineer",
      "  Zero Beta, Colombo | 2023 – 2024",
      "  Worked on core financial risk management",
      "  product suite. Reduced system latency",
      "  from 1000ms to 10ms.",
      "",
      "► Software Engineer",
      "  Zero Beta, Colombo | 2022 – 2023",
      "  Established unit testing frameworks.",
      "  Leveraged Redis caching and MySQL.",
      "",
      "► Software Engineer",
      "  Axiata Digital Labs | 2021 – 2022",
      "  Modernized monolithic apps into",
      "  microservices. Migrated on-prem K8s",
      "  to AWS EKS.",
      "",
      "┌──────────────────────────────────────────┐",
      "│          EDUCATION                        │",
      "└──────────────────────────────────────────┘",
      "",
      "► BSc. Eng (Hons) Electronic & Telecom",
      "  University of Moratuwa — 2017-2021",
      "",
      "┌──────────────────────────────────────────┐",
      "│          CERTIFICATIONS                   │",
      "└──────────────────────────────────────────┘",
      "",
      "  ✓ AWS Solutions Architect – Associate",
      "  ✓ Cisco CCNA",
    ],

    "skills.txt": [
      "┌──────────────────────────────────────────┐",
      "│          TECHNICAL SKILLS                 │",
      "└──────────────────────────────────────────┘",
      "",
      "  Programming Languages",
      "    Java · Python · JavaScript · Bash",
      "",
      "  Cloud Technologies",
      "    AWS: EKS, ECS, ELB, EC2, VPC,",
      "    Lambda, DynamoDB, SQS, Bedrock,",
      "    CloudFormation, RDS, EFS, EBS",
      "",
      "  Container Orchestration",
      "    Kubernetes · Docker · EKS · ECS",
      "",
      "  Web Frameworks",
      "    Spring Boot · FastAPI",
      "",
      "  Message Brokers",
      "    Kafka · AWS SQS · AWS SNS",
      "",
      "  Databases",
      "    MySQL · PostgreSQL · MongoDB",
      "    DynamoDB · Oracle · Redis",
      "",
      "  Infrastructure as Code",
      "    CloudFormation · Terraform · CDK",
      "",
      "  CI/CD & Version Control",
      "    Jenkins · Git",
      "",
      "  Monitoring & Observability",
      "    Prometheus · X-Ray · CloudWatch",
    ]
  };

  var fileNames = Object.keys(files);

  // ===== COMMAND HANDLERS =====
  var commands = {
    help: function () {
      return [
        "",
        "Available commands:",
        "",
        "  cat <file>   — View file contents",
        "  ls           — List files",
        "  clear        — Clear terminal",
        "  whoami       — Who am I?",
        "  pwd          — Print working directory",
        "  date         — Show current date",
        "  echo <text>  — Print text",
        "  history      — Command history",
        "  help         — Show this help",
        "",
        "Files: " + fileNames.join("  "),
        "",
        "Tip: Try 'cat about.txt'",
        "",
      ];
    },
    ls: function (args) {
      if (args && args[0] === "-la") {
        var lines = ["total " + fileNames.length];
        fileNames.forEach(function (f) {
          var size = files[f].join("\n").length;
          lines.push("-rw-r--r--  1 daham  staff  " + size + "  Jan  1 00:00  " + f);
        });
        return lines;
      }
      return [fileNames.join("   ")];
    },
    cat: function (args) {
      if (!args || !args.length) return ["cat: missing operand"];
      var fname = args[0];
      if (files[fname]) return [""].concat(files[fname]).concat([""]);
      return ["cat: " + fname + ": No such file or directory"];
    },
    clear: function () { return null; },
    whoami: function () { return ["daham"]; },
    pwd: function () { return ["/home/daham/portfolio"]; },
    date: function () { return [new Date().toString()]; },
    echo: function (args) { return [(args || []).join(" ")]; },
    history: function () {
      return cmdHistory.map(function (cmd, i) { return "  " + (i + 1) + "  " + cmd; });
    },
  };

  var cmdHistory = [];
  var historyIndex = -1;

  // ===== TERMINAL ENGINE =====
  function init() {
    var output = document.getElementById("terminal-output");
    var input = document.getElementById("terminal-input");
    var body = document.getElementById("terminal-body");
    if (!output || !input || !body) return;

    function addLine(text, cls) {
      var div = document.createElement("div");
      if (cls) div.className = cls;
      div.style.whiteSpace = "pre";
      div.textContent = text;
      output.appendChild(div);
    }

    function addLines(lines, cls) {
      if (!lines) return;
      lines.forEach(function (l) { addLine(l, cls); });
    }

    function scrollBottom() {
      body.scrollTop = body.scrollHeight;
    }

    // ===== WELCOME BANNER =====
    var bannerLines = [
      { text: "", cls: "" },
      { text: "Welcome to Daham Navinda's Portfolio Terminal", cls: "log-cyan" },
      { text: "─────────────────────────────────────────────", cls: "log-dim" },
      { text: "", cls: "" },
      { text: "Type 'help' to see available commands.", cls: "log-dim" },
      { text: "Try:  cat about.txt  |  cat experience.txt  |  cat skills.txt", cls: "log-dim" },
      { text: "", cls: "" },
    ];

    function showBanner() {
      bannerLines.forEach(function (l) { addLine(l.text, l.cls); });
      scrollBottom();
    }

    function exec(raw) {
      var trimmed = raw.trim();
      var cmdDiv = document.createElement("div");
      cmdDiv.style.whiteSpace = "pre";
      var promptSpan = document.createElement("span");
      promptSpan.className = "log-green";
      promptSpan.textContent = PROMPT;
      cmdDiv.appendChild(promptSpan);
      var cmdSpan = document.createElement("span");
      cmdSpan.textContent = trimmed;
      cmdDiv.appendChild(cmdSpan);
      output.appendChild(cmdDiv);

      if (!trimmed) { scrollBottom(); return; }

      cmdHistory.push(trimmed);
      historyIndex = cmdHistory.length;

      var parts = trimmed.split(/\s+/);
      var cmd = parts[0].toLowerCase();
      var args = parts.slice(1);

      if (cmd === "clear") {
        output.innerHTML = "";
        showBanner();
        return;
      }

      if (cmd === "cat" && args.length === 0) {
        addLines(["", "Usage: cat <filename>", "Files: " + fileNames.join("  "), ""]);
        scrollBottom();
        return;
      }

      if (commands[cmd]) {
        var result = commands[cmd](args);
        if (result) addLines(result);
      } else {
        addLine(cmd + ": command not found. Type 'help' for available commands.");
      }
      scrollBottom();
    }

    // ===== INPUT HANDLING =====
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        exec(input.value);
        input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; input.value = cmdHistory[historyIndex]; }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < cmdHistory.length - 1) { historyIndex++; input.value = cmdHistory[historyIndex]; }
        else { historyIndex = cmdHistory.length; input.value = ""; }
      } else if (e.key === "Tab") {
        e.preventDefault();
        var val = input.value.trim();
        var parts = val.split(/\s+/);
        if (parts.length >= 2) {
          var partial = parts[parts.length - 1];
          var matches = fileNames.filter(function (f) { return f.indexOf(partial) === 0; });
          if (matches.length === 1) { parts[parts.length - 1] = matches[0]; input.value = parts.join(" "); }
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        exec("clear");
      }
    });

    body.addEventListener("click", function () { input.focus(); });

    showBanner();
    setTimeout(function () { input.focus(); }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
