import uuid
import time
from typing import List, Optional
from .schema import Entity, Relation, GraphData
from .database import GraphDatabase

class KnowledgeGraphEngine:
    def __init__(self, db_path: str):
        self.db = GraphDatabase(db_path)

    def record_entity(self, id: str, type: str, name: str, metadata: dict = {}) -> Entity:
        entity = Entity(id=id, type=type, name=name, metadata=metadata)
        self.db.upsert_entity(entity)
        return entity

    def record_relation(self, source_id: str, target_id: str, type: str, metadata: dict = {}) -> Relation:
        rel_id = f"{source_id}_{target_id}_{type}_{int(time.time())}"
        relation = Relation(id=rel_id, source_id=source_id, target_id=target_id, type=type, metadata=metadata)
        self.db.add_relation(relation)
        return relation

    def get_graph_data(self) -> GraphData:
        entities = self.db.get_all_entities()
        relations = self.db.get_all_relations()
        
        nodes = []
        for e in entities:
            nodes.append({
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "metadata": e.metadata
            })
            
        links = []
        for r in relations:
            links.append({
                "source": r.source_id,
                "target": r.target_id,
                "type": r.type,
                "metadata": r.metadata
            })
            
        return GraphData(nodes=nodes, links=links)
