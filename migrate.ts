import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const db = new Database("family.db");

async function migrate() {
    console.log("Starting cleaned migration...");

    // 1. Migrate family_members
    const members = db.prepare("SELECT * FROM family_members").all() as any[];
    console.log(`Migrating ${members.length} family members...`);
    for (const member of members) {
        const { id, ...data } = member;
        // Fix empty date strings
        if (data.birth_date === "") data.birth_date = null;

        const { error } = await supabase.from("family_members").upsert({ id, ...data });
        if (error) {
            console.error(`Failed member ${data.name}:`, error.message);
        } else {
            console.log(`✔ Member ${data.name} migrated`);
        }
    }

    // 2. Migrate users
    const users = db.prepare("SELECT * FROM users").all() as any[];
    console.log(`Migrating ${users.length} users...`);
    for (const user of users) {
        const { id, ...data } = user;
        const { error } = await supabase.from("users").upsert({ id, ...data });
        if (error) console.error(`Failed user ${data.phone_or_email}:`, error.message);
    }

    // 3. Migrate events
    const events = db.prepare("SELECT * FROM events").all() as any[];
    console.log(`Migrating ${events.length} events...`);
    for (const event of events) {
        const { id, ...data } = event;
        if (data.date === "") data.date = null;
        const { error } = await supabase.from("events").upsert({ id, ...data });
        if (error) {
            console.error(`Failed event ${data.title}:`, error.message);
        } else {
            console.log(`✔ Event ${data.title} migrated`);
        }
    }

    // 4. Migrate messages
    const messages = db.prepare("SELECT * FROM messages").all() as any[];
    console.log(`Migrating ${messages.length} messages...`);
    for (const message of messages) {
        const { id, ...data } = message;
        const { error } = await supabase.from("messages").upsert({ id, ...data });
        if (error) {
            console.error(`Failed message from ${data.author_name}:`, error.message);
        } else {
            console.log(`✔ Message from ${data.author_name} migrated`);
        }
    }

    console.log("\nMigration finished!");
}

migrate().catch(console.error);
