export interface InfrastructureFeature {
  type: "Feature";
  properties: {
    id: number;
    name: string;
    status: "stable" | "warning" | "critical";
    load: number;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface PredictionData {
  time: number;
  value: number;
}

export interface SimulationEvent {
  type: "failure" | "spike" | "maintenance";
  targetId: number;
  severity: "low" | "medium" | "high";
}
