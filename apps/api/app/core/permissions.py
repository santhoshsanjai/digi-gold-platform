"""Permission catalogue, side-menu definition and default roles for the CRM.

A permission is "<module>:<action>". The CRM side menu is built from the user's
permissions, so adding a role never needs a code change.
"""

from dataclasses import dataclass

MODULES = (
    "dashboard",
    "rates",
    "customers",
    "payments",
    "redemptions",
    "expiry",
    "reports",
    "settings",
    "users",
    "roles",
    "stores",
)
ACTIONS = ("view", "create", "edit", "delete")
ALL_PERMISSIONS = frozenset(f"{m}:{a}" for m in MODULES for a in ACTIONS)


@dataclass(frozen=True)
class MenuItem:
    key: str
    label: str
    path: str
    icon: str
    permission: str


MENU = (
    MenuItem("dashboard", "Dashboard", "/", "layout-dashboard", "dashboard:view"),
    MenuItem("rates", "Gold rate", "/rates", "trending-up", "rates:view"),
    MenuItem("customers", "Customers", "/customers", "users", "customers:view"),
    MenuItem("payments", "Payments", "/payments", "credit-card", "payments:view"),
    MenuItem("redemptions", "Redemptions", "/redemptions", "store", "redemptions:view"),
    MenuItem("expiry", "Expiring lots", "/expiry", "alarm-clock", "expiry:view"),
    MenuItem("reports", "Reports", "/reports", "bar-chart", "reports:view"),
    MenuItem("users", "Users", "/users", "user-cog", "users:view"),
    MenuItem("roles", "Roles", "/roles", "shield", "roles:view"),
    MenuItem("stores", "Stores", "/stores", "map-pin", "stores:view"),
    MenuItem("settings", "Settings", "/settings", "settings", "settings:view"),
)


def _all(*modules: str) -> list[str]:
    return [f"{m}:{a}" for m in modules for a in ACTIONS]


OWNER_ROLE = "Owner"

# Seeded for every new tenant; the client can edit them or add more.
DEFAULT_ROLES: dict[str, tuple[str, list[str]]] = {
    OWNER_ROLE: ("Everything, including settings, users and roles", sorted(ALL_PERMISSIONS)),
    "Manager": (
        "Customers, payments, redemptions, reports and rate entry",
        _all("dashboard", "rates", "customers", "payments", "redemptions", "expiry")
        + ["reports:view", "stores:view"],
    ),
    "Rate manager": (
        "Enter and confirm the daily gold rate",
        ["dashboard:view", "rates:view", "rates:create", "rates:edit"],
    ),
    "Store staff": (
        "Find customers and redeem in their own store",
        ["dashboard:view", "customers:view", "redemptions:view", "redemptions:create"],
    ),
    "Viewer": (
        "Read-only dashboards and reports",
        ["dashboard:view", "reports:view", "customers:view", "payments:view"],
    ),
}


def validate_permissions(perms: list[str]) -> list[str]:
    unknown = set(perms) - ALL_PERMISSIONS
    if unknown:
        raise ValueError(f"unknown permissions: {', '.join(sorted(unknown))}")
    return sorted(set(perms))


def menu_for(perms: set[str]) -> list[MenuItem]:
    return [item for item in MENU if item.permission in perms]
