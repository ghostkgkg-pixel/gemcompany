import sqlite3
import json
import os
from typing import List
from .schema import Entity, Relation

class GraphDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS entities (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    metadata TEXT,
                    created_at REAL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS relations (
                    id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    metadata TEXT,
                    created_at REAL,
                    FOREIGN KEY(source_id) REFERENCES entities(id),
                    FOREIGN KEY(target_id) REFERENCES entities(id)
                )
            """)
            conn.commit()

    def upsert_entity(self, entity: Entity):
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO entities (id, type, name, metadata, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (entity.id, entity.type, entity.name, json.dumps(entity.metadata), entity.created_at))
            conn.commit()

    def add_relation(self, relation: Relation):
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO relations (id, source_id, target_id, type, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (relation.id, relation.source_id, relation.target_id, relation.type, 
                  json.dumps(relation.metadata), relation.created_at))
            conn.commit()

    def get_all_entities(self) -> List[Entity]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM entities").fetchall()
            return [
                Entity(
                    id=row["id"],
                    type=row["type"],
                    name=row["name"],
                    metadata=json.loads(row["metadata"]),
                    created_at=row["created_at"]
                ) for row in rows
            ]

    def get_all_relations(self) -> List[Relation]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM relations").fetchall()
            return [
                Relation(
                    id=row["id"],
                    source_id=row["source_id"],
                    target_id=row["target_id"],
                    type=row["type"],
                    metadata=json.loads(row["metadata"]),
                    created_at=row["created_at"]
                ) for row in rows
            ]
