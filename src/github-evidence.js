import { repositoryProjects } from './project-directory.js';
// Public repository descriptions, snapshot of github.com/ajithreddy1234.
export default [
  {
    source: 'github',
    terms: ['flowforge', 'etl', 'pipeline', 'scheduling', 'sql', 'sheets'],
    text: 'FlowForge is Ajith’s workflow automation project. Its GitHub repository documents a React pipeline canvas, FastAPI execution services, Pandas transformations, Google Sheets delivery, job scheduling, and a metadata-aware SQL assistant.',
  },
  {
    source: 'github',
    terms: ['doculens', 'rag', 'citations', 'document', 'retrieval'],
    text: 'DocuLens is Ajith’s public document intelligence and RAG evaluation project. Its repository is listed on his GitHub profile.',
  },
  {
    source: 'github',
    terms: ['github', 'repositories', 'repos', 'source', 'code'],
    text: 'Ajith’s GitHub is ajithreddy1234. Public projects include FlowForge, DocuLens, and the Meeting Minutes Generator & Information Retrieval Agent.',
  },
  ...repositoryProjects.map((project) => ({ source: 'github', terms: [project.name.toLowerCase(), ...project.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)], text: project.title + ': ' + project.description })),
];
