# The fixed set of team/file-sharing categories. Kept in one place so
# validation stays consistent across team membership and file access grants.
# Adding a new category later (e.g. "Landscape") is a one-line change here -
# no schema migration needed since it's stored as a plain string column.
TEAM_CATEGORIES = ["Architect", "Client", "Structural", "Electrical", "Plumbing", "A/C", "Others"]

# Categories a vendor can be assigned to (excludes Architect/Client, which are
# implied by role rather than chosen).
VENDOR_CATEGORIES = ["Structural", "Electrical", "Plumbing", "A/C", "Others"]
