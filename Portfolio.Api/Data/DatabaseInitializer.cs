using System.Text.Json;
using Dapper;
using Portfolio.Api.Models;
using Portfolio.Api.Repositories;
using Portfolio.Api.Security;

namespace Portfolio.Api.Data;

/// <summary>
/// Ensures the database exists, applies the schema, and seeds the admin
/// account + default projects on first run. Safe to run on every startup.
/// </summary>
public class DatabaseInitializer
{
    private readonly ISqlConnectionFactory _factory;
    private readonly IProjectRepository _projects;
    private readonly IContentRepository _content;
    private readonly IAdminRepository _admins;
    private readonly IConfiguration _config;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(
        ISqlConnectionFactory factory,
        IProjectRepository projects,
        IContentRepository content,
        IAdminRepository admins,
        IConfiguration config,
        ILogger<DatabaseInitializer> logger)
    {
        _factory = factory;
        _projects = projects;
        _content = content;
        _admins = admins;
        _config = config;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        // The PostgreSQL database itself is provisioned by the host (Render) or by
        // the local docker-compose/Postgres install — so we only apply the schema.
        var schemaPath = Path.Combine(AppContext.BaseDirectory, "Data", "schema.sql");
        var schema = await File.ReadAllTextAsync(schemaPath);
        using (var conn = _factory.Create())
        {
            conn.Open();
            await conn.ExecuteAsync(schema);
        }
        _logger.LogInformation("Schema applied.");

        // Seed admin + projects + section content.
        await SeedAdminAsync();
        await SeedProjectsAsync();
        await SeedContentAsync();
    }

    private async Task SeedAdminAsync()
    {
        var username = _config["Admin:Username"];
        var password = _config["Admin:Password"];

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("Admin:Username / Admin:Password not configured — skipping admin seed. Set them via environment variables.");
            return;
        }

        // Treat configuration as the source of truth: create or update the configured
        // admin, and remove any stale admin accounts so old credentials stop working.
        var existing = await _admins.GetByUsernameAsync(username);
        if (existing is null)
        {
            await _admins.CreateAsync(username, PasswordHasher.Hash(password));
            _logger.LogInformation("Seeded admin user '{User}'.", username);
        }
        else
        {
            await _admins.UpdatePasswordAsync(username, PasswordHasher.Hash(password));
            _logger.LogInformation("Updated admin user '{User}' password from config.", username);
        }

        await _admins.DeleteOthersAsync(username);
    }

    private async Task SeedProjectsAsync()
    {
        if (await _projects.CountAsync() > 0) return;

        foreach (var p in DefaultProjects())
            await _projects.CreateAsync(p);

        _logger.LogInformation("Seeded default projects.");
    }

    // ---- section content seeding ----

    private async Task SeedContentAsync()
    {
        await SeedSectionAsync("profile", new object[]
        {
            new
            {
                intro = "Hi, I'm Bharath Manepalli.",
                headlineLead = "I build ",
                headlineAccent = "reliable backends",
                headlineTail = " & clean full-stack products.",
                availability = "2025 Graduate · Available for full-time roles",
                tagline = "Full Stack Developer specializing in C# & .NET backend engineering — designing scalable RESTful APIs, secure authentication systems, and modern web experiences from Hyderabad, India.",
                bio1 = "I'm a motivated Computer Science graduate with hands-on experience in full-stack web development across PHP, JavaScript, React, Node.js, C#, .NET and ASP.NET Core Web API. I enjoy building scalable web applications with robust authentication systems, role-based access control, and clean RESTful APIs.",
                bio2 = "My projects range from a C# / ASP.NET Core expense-tracking API and a MERN cab-booking system to an AI-powered design validation tool built on LLMs and vector databases. I'm comfortable with Git-based collaboration and enjoy sharpening my problem-solving with 200+ solved algorithmic challenges.",
                location = "Hyderabad, Telangana, India",
                email = "bharath3890@gmail.com",
                phone = "+91 91107 04526",
                github = "https://github.com/Nani-Hatake",
                linkedin = "https://www.linkedin.com/in/manepalli-bharath-247b3b233/",
                resumeUrl = "Bharath_Manepalli_Resume.pdf"
            }
        });

        await SeedSectionAsync("stats", new object[]
        {
            new { value = "200+", label = "DSA problems solved" },
            new { value = "7.2", label = "B.Tech CGPA" },
            new { value = "3×", label = "Coding contest wins" },
            new { value = ".NET", label = "Backend specialist" }
        });

        await SeedSectionAsync("skills", new object[]
        {
            new { title = "Programming Languages", icon = "code", items = new[] { "C#", "PHP", "JavaScript", "Python (Basic)" } },
            new { title = "Web Technologies", icon = "globe", items = new[] { "HTML5", "CSS3", "React.js", "Node.js" } },
            new { title = "Backend Development", icon = "server", items = new[] { "ASP.NET Core Web API", "REST API Design", "Authentication", "Server-side Dev" } },
            new { title = "Databases", icon = "database", items = new[] { "SQL Server", "MySQL", "MongoDB", "Dapper ORM" } },
            new { title = "Tools & Practices", icon = "tool", items = new[] { "Git", "GitHub", "OOP", "SDLC" } },
            new { title = "AI & LLM Technologies", icon = "sparkles", items = new[] { "Large Language Models", "Vector Databases", "RAG" } }
        });

        await SeedSectionAsync("experience", new object[]
        {
            new
            {
                role = "Full Stack Developer Intern",
                company = "Hilton Tech",
                kind = "Internship",
                bullets = new[]
                {
                    "Developed full-stack web application features using PHP, HTML, CSS, JavaScript, and MySQL.",
                    "Implemented secure user authentication and role-based access control.",
                    "Built responsive frontend components integrated with backend services via AJAX & JSON.",
                    "Managed MySQL data with full CRUD and collaborated via Git & GitHub."
                }
            }
        });

        await SeedSectionAsync("education", new object[]
        {
            new
            {
                degree = "B.Tech, Computer Science & Engineering",
                org = "Kallam Haranadhareddy Institute of Technology, Guntur",
                period = "2021 – 2025",
                notes = new[] { "CGPA: 7.2 / 10", "No active backlogs" }
            },
            new
            {
                degree = "Intermediate (Class XII)",
                org = "NRI Junior College, Guntur",
                period = "2019 – 2021",
                notes = new[] { "Percentage: 74.3%" }
            }
        });

        await SeedSectionAsync("achievements", new object[]
        {
            new { text = "200+ problems solved (150+ HackerRank · 50+ LeetCode)" },
            new { text = "Winner — Codesprint Coding Challenge" },
            new { text = "Runner-up — Coding Quiz Competition" },
            new { text = "1st Place — Codetantra Coding Hackathon" }
        });

        await SeedSectionAsync("certifications", new object[]
        {
            new { name = "Python Programming — NPTEL" },
            new { name = "SQL — HackerRank" },
            new { name = "Machine Learning — NPTEL" },
            new { name = "Cisco Networking Essentials" }
        });
    }

    private async Task SeedSectionAsync(string section, object[] items)
    {
        if (await _content.CountAsync(section) > 0) return;
        for (var i = 0; i < items.Length; i++)
        {
            await _content.CreateAsync(section, new ContentWriteDto
            {
                SortOrder = i,
                Data = JsonSerializer.SerializeToElement(items[i])
            });
        }
        _logger.LogInformation("Seeded content section '{Section}' ({Count} items).", section, items.Length);
    }

    private static IEnumerable<ProjectWriteDto> DefaultProjects() => new[]
    {
        new ProjectWriteDto
        {
            Title = "ResolveDesk",
            Summary = "Enterprise IT helpdesk & ticket-management system.",
            Description = "ResolveDesk lets organizations track, manage, and resolve support tickets end to end. It features a tickets dashboard, detailed case views, collaborative comment threads, and request-creation forms — backed by an ASP.NET Core API over SQL Server with a React 18 + Vite frontend.",
            TechStack = new() { "C#", "ASP.NET Core", "SQL Server", "React", "Vite" },
            Features = new()
            {
                "Full ticket lifecycle: create, assign, comment, resolve",
                "Dashboard with status filtering and detailed case views",
                "ASP.NET Core Web API backed by SQL Server Express",
                "React 18 + Vite single-page frontend"
            },
            GithubLink = "https://github.com/Nani-Hatake/ResolveDesk",
            SortOrder = 1
        },
        new ProjectWriteDto
        {
            Title = "AuraStream",
            Summary = "Full-stack music streaming app with waveform visualization.",
            Description = "AuraStream is a music streaming web app with real audio playback, dynamic waveform visualization, and persistent user preferences. Browse tracks, artists, and playlists through a polished React interface backed by an OOP PHP + MySQL layer for data persistence and stream tracking.",
            TechStack = new() { "React", "Vite", "PHP", "MySQL", "HTML5 Audio API" },
            Features = new()
            {
                "Real audio playback with dynamic waveform visualization",
                "Browse tracks, artists, and playlists",
                "Persistent user preferences",
                "OOP PHP + MySQL backend for stream tracking"
            },
            GithubLink = "https://github.com/Nani-Hatake/AuraStream",
            SortOrder = 2
        },
        new ProjectWriteDto
        {
            Title = "TopShot Sports Platform",
            Summary = "Sports facility booking & community platform.",
            Description = "A sports facility management and community platform where users book courts, join leagues, access training programs, and shop for equipment. Supports multiple sports such as badminton and pickleball, with memberships, news, authentication, and contact management.",
            TechStack = new() { "PHP", "CSS", "JavaScript" },
            Features = new()
            {
                "Court booking across multiple sports",
                "Leagues, training programs, and a pro shop",
                "Membership and user authentication",
                "News articles and contact management"
            },
            GithubLink = "https://github.com/Nani-Hatake/topshot-sports-platform",
            SortOrder = 3
        },
        new ProjectWriteDto
        {
            Title = "Artisan Brew — Coffee App",
            Summary = "Full-stack premium coffee ordering app with rewards.",
            Description = "A premium coffee ordering application with user authentication, product browsing, shopping cart, order management, and a loyalty rewards system. Built on a FastAPI + SQLAlchemy backend with JWT auth and a React + Tailwind CSS frontend for a complete e-commerce flow.",
            TechStack = new() { "Python", "FastAPI", "SQLAlchemy", "React", "Tailwind CSS" },
            Features = new()
            {
                "JWT-authenticated user accounts",
                "Product catalog, cart, and order management",
                "Loyalty rewards redemption",
                "FastAPI + SQLAlchemy backend with a React frontend"
            },
            GithubLink = "https://github.com/Nani-Hatake/CoffeeShop",
            SortOrder = 4
        },
        new ProjectWriteDto
        {
            Title = "AI Bug Tracker",
            Summary = "AI-assisted issue triage and bug tracking.",
            Description = "A Node.js bug-tracking application that brings AI assistance to issue triage and management, providing a lightweight, API-driven workflow for logging and organizing software defects.",
            TechStack = new() { "JavaScript", "Node.js", "AI" },
            Features = new()
            {
                "AI-assisted issue triage",
                "Lightweight API-driven workflow",
                "Log and organize software defects"
            },
            GithubLink = "https://github.com/Nani-Hatake/ai-bug-tracker",
            SortOrder = 5
        },
        new ProjectWriteDto
        {
            Title = "Lumora Nutrition Website",
            Summary = "Responsive nutrition website with dynamic PHP backend.",
            Description = "A responsive nutrition website showcasing health products, services, and information. Built end to end with HTML, CSS, JavaScript, and PHP, featuring dynamic contact forms and MySQL database integration with a focus on accessibility.",
            TechStack = new() { "HTML", "CSS", "JavaScript", "PHP", "MySQL" },
            Features = new()
            {
                "Dynamic contact forms with MySQL integration",
                "Responsive, accessibility-focused pages",
                "Content for products, services, and nutrition info"
            },
            GithubLink = "https://github.com/Nani-Hatake/Lumora-nutritionwebsite",
            SortOrder = 6
        },
        new ProjectWriteDto
        {
            Title = "React Frontend Starter",
            Summary = "Modern React + Vite template deployed on Vercel.",
            Description = "A modern React + Vite frontend template configured with Tailwind CSS, ESLint, and PostCSS, deployed on Vercel — a clean, production-ready base for spinning up new interfaces quickly.",
            TechStack = new() { "React", "Vite", "Tailwind CSS", "JavaScript" },
            Features = new()
            {
                "Vite build tooling with fast HMR",
                "Tailwind CSS + PostCSS configured",
                "ESLint for code quality",
                "Vercel deployment ready"
            },
            GithubLink = "https://github.com/Nani-Hatake/my-frontend",
            SortOrder = 7
        },
        new ProjectWriteDto
        {
            Title = "Binary Calculator",
            Summary = "Beginner-friendly binary/decimal calculator.",
            Description = "A beginner-friendly binary calculator that performs arithmetic and conversions between binary and decimal, built with vanilla JavaScript to demonstrate core logic and clean DOM handling.",
            TechStack = new() { "JavaScript", "HTML", "CSS" },
            Features = new()
            {
                "Binary arithmetic operations",
                "Binary ↔ decimal conversion",
                "Vanilla JavaScript with clean DOM handling"
            },
            GithubLink = "https://github.com/Nani-Hatake/Binary-Calculator",
            SortOrder = 8
        }
    };
}
