"use client";

import { use } from "react";
import {
  CaseStudyWorkspaceView,
  decodeTaskParam,
} from "@case-study/mfe";
import { EngineeringSurveyAdvisoryPanel } from "@engineering-office/mfe";
import { EvaluatorAdvisoryPanel } from "@evaluator/mfe";
import { FieldInspectionAdvisoryPanel } from "@case-study/mfe";

export default function CaseStudyWorkspacePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return (
    <CaseStudyWorkspaceView
      taskId={decodeTaskParam(taskId)}
      renderPartiesExtras={({ task, property, tasks }) =>
        property?.id ? (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <EngineeringSurveyAdvisoryPanel
              parentTask={task}
              propertyId={property.id}
              tasks={tasks}
            />
            <FieldInspectionAdvisoryPanel
              parentTask={task}
              propertyId={property.id}
              tasks={tasks}
            />
            <EvaluatorAdvisoryPanel
              parentTask={task}
              propertyId={property.id}
              tasks={tasks}
            />
          </div>
        ) : null
      }
    />
  );
}
