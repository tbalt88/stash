from cli.client import StashClient, skill_permissions_for_access


def _post_stub_client():
    client = StashClient.__new__(StashClient)
    calls: list[tuple[str, dict]] = []

    def fake_post(path: str, json=None) -> dict:
        calls.append((path, json))
        return {"ok": True}

    client._post = fake_post  # type: ignore[method-assign]
    return client, calls


def test_skill_permissions_for_access() -> None:
    assert skill_permissions_for_access("public") == {
        "workspace_permission": "read",
        "public_permission": "read",
    }
    assert skill_permissions_for_access("workspace") == {
        "workspace_permission": "read",
        "public_permission": "none",
    }
    assert skill_permissions_for_access("private") == {
        "workspace_permission": "none",
        "public_permission": "none",
    }


def test_publish_skill_folder_sends_permission_fields() -> None:
    client, calls = _post_stub_client()

    client.publish_skill_folder(
        "WS", "F1", title="Launch notes", **skill_permissions_for_access("public")
    )

    assert calls == [
        (
            "/api/v1/workspaces/WS/skills",
            {
                "folder_id": "F1",
                "description": "",
                "workspace_permission": "read",
                "public_permission": "read",
                "discoverable": False,
                "title": "Launch notes",
            },
        )
    ]


def test_publish_skill_folder_defaults_private() -> None:
    client, calls = _post_stub_client()

    client.publish_skill_folder("WS", "F1")

    assert calls == [
        (
            "/api/v1/workspaces/WS/skills",
            {
                "folder_id": "F1",
                "description": "",
                "workspace_permission": "read",
                "public_permission": "none",
                "discoverable": False,
            },
        )
    ]
