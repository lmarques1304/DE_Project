const db = require("./database");
const bcrypt = require("bcryptjs");

// Demo accounts
const users = [
    {
        name: "Site Administrator",
        email: "admin@instantdemocracy.test",
        password: "AdminDemo2026!",
        role: "admin",
        organization: null
    },
    {
        name: "University of Coimbra",
        email: "uc@instantdemocracy.test",
        password: "UCDemo2026!",
        role: "uc",
        organization: "University of Coimbra"
    },
    {
        name: "Núcleo de Estudantes de Informática",
        email: "nei@instantdemocracy.test",
        password: "NEIDemo2026!",
        role: "nuclei",
        organization: "Núcleo de Estudantes de Informática"
    },
    {
        name: "Student One",
        email: "student1@instantdemocracy.test",
        password: "StudentDemo2026!",
        role: "student",
        organization: null
    },
    {
        name: "Student Two",
        email: "student2@instantdemocracy.test",
        password: "StudentDemo2026!",
        role: "student",
        organization: null
    }
];

const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users
    (name, email, password, role, organization)
    VALUES (?, ?, ?, ?, ?)
`);

const insertDemoUsers = db.transaction(() => {
    for (const user of users) {
        const hashedPassword = bcrypt.hashSync(user.password, 12);

        const result = insertUser.run(
            user.name,
            user.email,
            hashedPassword,
            user.role,
            user.organization
        );

        if (result.changes > 0) {
            console.log(`Created: ${user.email} (${user.role})`);
        } else {
            console.log(`Already exists: ${user.email}`);
        }
    }
});

insertDemoUsers();

console.log("Demo accounts ready!");