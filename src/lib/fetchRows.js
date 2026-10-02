// Supabase caps a response at 1,000 rows by default. Never silently truncate history.
export async function fetchAllRows(queryFactory, isCurrent = () => true) {
    const rows = [];
    while (isCurrent()) {
        const { data, error } = await queryFactory().range(rows.length, rows.length + 999);
        if (error) throw error;
        if (!data?.length) break;
        rows.push(...data);
    }
    return rows;
}
