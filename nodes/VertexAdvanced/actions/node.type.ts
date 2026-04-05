type NodeMap = {
  text: 'message';
  image: 'analyze' | 'generate' | 'edit';
  video: 'analyze' | 'generate';
  audio: 'transcribe' | 'analyze';
};

export type VertexAdvancedType = {
  [K in keyof NodeMap]: {
    resource: K;
    operation: NodeMap[K];
  };
}[keyof NodeMap];
