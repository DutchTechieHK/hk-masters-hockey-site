import { ne } from "drizzle-orm";
import { playersTable } from "@workspace/db";

/** Normal member directories must never include archived accounts.
 * Only the explicit restore-members query may opt into that status. */
export const visibleMember = () => ne(playersTable.memberStatus, "archived");
