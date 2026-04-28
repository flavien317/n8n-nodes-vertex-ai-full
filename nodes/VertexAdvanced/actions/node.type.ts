type NodeMap = {
  text: 'message';
  image: 'analyze' | 'generate' | 'edit';
  video: 'analyze' | 'generate';
  audio: 'transcribe' | 'analyze';
  document: 'analyze';
};

export type VertexAdvancedType = {
  [K in keyof NodeMap]: {
    resource: K;
    operation: NodeMap[K];
  };
}[keyof NodeMap];
