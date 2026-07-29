import { useState } from 'react';
import type { Project } from '../../types/database';

type FieldKey = keyof Pick<
  Project,
  | 'description'
  | 'problem'
  | 'opportunity'
  | 'target_audience'
  | 'personas'
  | 'competitors'
  | 'stakeholders'
  | 'message_main'
  | 'tone_of_voice'
  | 'promise'
  | 'value_proposition'
  | 'differentiators'
  | 'strategy'
  | 'restrictions'
  | 'assumptions'
>;

interface Section {
  title: string;
  fields: { key: FieldKey; label: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Contexto',
    fields: [
      { key: 'description', label: 'Descrição' },
      { key: 'problem', label: 'Problema' },
      { key: 'opportunity', label: 'Oportunidade' },
    ],
  },
  {
    title: 'Público & Stakeholders',
    fields: [
      { key: 'target_audience', label: 'Público' },
      { key: 'personas', label: 'Personas' },
      { key: 'competitors', label: 'Concorrentes / referências' },
      { key: 'stakeholders', label: 'Stakeholders' },
    ],
  },
  {
    title: 'Mensagem & Posicionamento',
    fields: [
      { key: 'message_main', label: 'Mensagem principal' },
      { key: 'tone_of_voice', label: 'Tom de voz' },
      { key: 'promise', label: 'Promessa' },
      { key: 'value_proposition', label: 'Proposta de valor' },
      { key: 'differentiators', label: 'Diferenciais' },
    ],
  },
  {
    title: 'Estratégia',
    fields: [
      { key: 'strategy', label: 'Estratégia' },
      { key: 'restrictions', label: 'Restrições' },
      { key: 'assumptions', label: 'Premissas' },
    ],
  },
];

export default function ProjectPlanejamento({
  project,
  onSave,
}: {
  project: Project;
  onSave: (fields: Partial<Project>) => void;
}) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Project>>({});

  function startEdit(section: Section) {
    const values: Partial<Project> = {};
    section.fields.forEach((f) => {
      values[f.key] = project[f.key];
    });
    setDraft(values);
    setEditingSection(section.title);
  }

  function saveSection() {
    onSave(draft);
    setEditingSection(null);
  }

  return (
    <div>
      {SECTIONS.map((section) => (
        <div className="panel" key={section.title}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>{section.title}</h4>
            {editingSection !== section.title && (
              <button className="btn ghost sm" onClick={() => startEdit(section)}>
                Editar
              </button>
            )}
          </div>
          {editingSection === section.title ? (
            <div>
              {section.fields.map((f) => (
                <div className="form-field" key={f.key}>
                  <label htmlFor={`proj-pl-${f.key}`}>{f.label}</label>
                  <textarea
                    id={`proj-pl-${f.key}`}
                    rows={2}
                    value={(draft[f.key] as string) ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setEditingSection(null)}>
                  Cancelar
                </button>
                <button className="btn" onClick={saveSection}>
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            section.fields.map((f) => (
              <div className="field-row" key={f.key}>
                <span className="k">{f.label}</span>
                <span style={{ textAlign: 'right', color: project[f.key] ? 'var(--text)' : 'var(--text-faint)' }}>
                  {(project[f.key] as string) || 'Não preenchido'}
                </span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
