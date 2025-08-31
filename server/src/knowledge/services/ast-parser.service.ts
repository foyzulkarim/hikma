import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import Cpp from 'tree-sitter-cpp';
import C from 'tree-sitter-c';
import CSharp from 'tree-sitter-c-sharp';

export interface ASTNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: ASTNode[];
  parent?: ASTNode;
}

export interface CodeChunk {
  content: string;
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'import' | 'comment' | 'other';
  name?: string;
  startLine: number;
  endLine: number;
  language: string;
  metadata: {
    complexity?: number;
    dependencies?: string[];
    exports?: string[];
    docstring?: string;
    parameters?: string[];
    returnType?: string;
  };
}

export interface ParseResult {
  chunks: CodeChunk[];
  ast: ASTNode;
  errors: string[];
  language: string;
}

type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp' | 'c' | 'csharp';

class ASTParserService {
  private parsers: Map<SupportedLanguage, Parser> = new Map();
  private languageMap: Map<string, SupportedLanguage> = new Map([
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
    ['typescript', 'typescript'],
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['javascript', 'javascript'],
    ['py', 'python'],
    ['python', 'python'],
    ['java', 'java'],
    ['go', 'go'],
    ['rs', 'rust'],
    ['rust', 'rust'],
    ['cpp', 'cpp'],
    ['cc', 'cpp'],
    ['cxx', 'cpp'],
    ['c++', 'cpp'],
    ['c', 'c'],
    ['cs', 'csharp'],
    ['csharp', 'csharp']
  ]);

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    try {
      // TypeScript/TSX
      const tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript);
      this.parsers.set('typescript', tsParser);

      // JavaScript/JSX
      const jsParser = new Parser();
      jsParser.setLanguage(JavaScript);
      this.parsers.set('javascript', jsParser);

      // Python
      const pyParser = new Parser();
      pyParser.setLanguage(Python);
      this.parsers.set('python', pyParser);

      // Java
      const javaParser = new Parser();
      javaParser.setLanguage(Java);
      this.parsers.set('java', javaParser);

      // Go
      const goParser = new Parser();
      goParser.setLanguage(Go);
      this.parsers.set('go', goParser);

      // Rust
      const rustParser = new Parser();
      rustParser.setLanguage(Rust);
      this.parsers.set('rust', rustParser);

      // C++
      const cppParser = new Parser();
      cppParser.setLanguage(Cpp);
      this.parsers.set('cpp', cppParser);

      // C
      const cParser = new Parser();
      cParser.setLanguage(C);
      this.parsers.set('c', cParser);

      // C#
      const csParser = new Parser();
      csParser.setLanguage(CSharp);
      this.parsers.set('csharp', csParser);
    } catch (error) {
      console.error('Failed to initialize AST parsers:', error);
    }
  }

  public getSupportedLanguages(): string[] {
    return Array.from(this.languageMap.keys());
  }

  public isLanguageSupported(language: string): boolean {
    return this.languageMap.has(language.toLowerCase());
  }

  public async parseCode(code: string, language: string): Promise<ParseResult> {
    const normalizedLang = this.languageMap.get(language.toLowerCase());
    
    if (!normalizedLang) {
      return {
        chunks: [],
        ast: { type: 'error', text: '', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 0 }, children: [] },
        errors: [`Unsupported language: ${language}`],
        language
      };
    }

    const parser = this.parsers.get(normalizedLang);
    if (!parser) {
      return {
        chunks: [],
        ast: { type: 'error', text: '', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 0 }, children: [] },
        errors: [`Parser not available for language: ${normalizedLang}`],
        language
      };
    }

    try {
      const tree = parser.parse(code);
      const ast = this.convertToASTNode(tree.rootNode, code);
      const chunks = this.extractChunks(tree.rootNode, code, normalizedLang);
      
      return {
        chunks,
        ast,
        errors: [],
        language: normalizedLang
      };
    } catch (error) {
      return {
        chunks: [],
        ast: { type: 'error', text: '', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 0 }, children: [] },
        errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        language: normalizedLang
      };
    }
  }

  private convertToASTNode(node: any, code: string): ASTNode {
    return {
      type: node.type,
      text: code.slice(node.startIndex, node.endIndex),
      startPosition: { row: node.startPosition.row, column: node.startPosition.column },
      endPosition: { row: node.endPosition.row, column: node.endPosition.column },
      children: node.children.map((child: any) => this.convertToASTNode(child, code))
    };
  }

  private extractChunks(rootNode: any, code: string, language: SupportedLanguage): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = code.split('\n');

    const traverse = (node: any) => {
      const chunk = this.createChunkFromNode(node, code, lines, language);
      if (chunk) {
        chunks.push(chunk);
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(rootNode);
    return chunks;
  }

  private createChunkFromNode(node: any, code: string, lines: string[], language: SupportedLanguage): CodeChunk | null {
    const nodeType = node.type;
    const text = code.slice(node.startIndex, node.endIndex);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    // Language-specific node type mapping
    const chunkType = this.getChunkType(nodeType, language);
    if (!chunkType) return null;

    const name = this.extractName(node, code);
    const metadata = this.extractMetadata(node, code, language);

    return {
      content: text,
      type: chunkType,
      name,
      startLine,
      endLine,
      language,
      metadata
    };
  }

  private getChunkType(nodeType: string, language: SupportedLanguage): CodeChunk['type'] | null {
    const typeMap: Record<SupportedLanguage, Record<string, CodeChunk['type']>> = {
      typescript: {
        'function_declaration': 'function',
        'method_definition': 'method',
        'arrow_function': 'function',
        'class_declaration': 'class',
        'interface_declaration': 'interface',
        'type_alias_declaration': 'type',
        'variable_declaration': 'variable',
        'import_statement': 'import',
        'comment': 'comment'
      },
      javascript: {
        'function_declaration': 'function',
        'method_definition': 'method',
        'arrow_function': 'function',
        'class_declaration': 'class',
        'variable_declaration': 'variable',
        'import_statement': 'import',
        'comment': 'comment'
      },
      python: {
        'function_definition': 'function',
        'class_definition': 'class',
        'import_statement': 'import',
        'import_from_statement': 'import',
        'comment': 'comment'
      },
      java: {
        'method_declaration': 'method',
        'class_declaration': 'class',
        'interface_declaration': 'interface',
        'import_declaration': 'import',
        'comment': 'comment'
      },
      go: {
        'function_declaration': 'function',
        'method_declaration': 'method',
        'type_declaration': 'type',
        'import_declaration': 'import',
        'comment': 'comment'
      },
      rust: {
        'function_item': 'function',
        'impl_item': 'class',
        'struct_item': 'type',
        'enum_item': 'type',
        'use_declaration': 'import',
        'line_comment': 'comment'
      },
      cpp: {
        'function_definition': 'function',
        'class_specifier': 'class',
        'preproc_include': 'import',
        'comment': 'comment'
      },
      c: {
        'function_definition': 'function',
        'preproc_include': 'import',
        'comment': 'comment'
      },
      csharp: {
        'method_declaration': 'method',
        'class_declaration': 'class',
        'interface_declaration': 'interface',
        'using_directive': 'import',
        'comment': 'comment'
      }
    };

    return typeMap[language]?.[nodeType] || null;
  }

  private extractName(node: any, code: string): string | undefined {
    // Try to find identifier child node
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return code.slice(child.startIndex, child.endIndex);
      }
    }
    return undefined;
  }

  private extractMetadata(node: any, code: string, language: SupportedLanguage): CodeChunk['metadata'] {
    const metadata: CodeChunk['metadata'] = {};

    // Extract docstring/comments
    const docstring = this.extractDocstring(node, code, language);
    if (docstring) {
      metadata.docstring = docstring;
    }

    // Extract parameters for functions/methods
    if (node.type.includes('function') || node.type.includes('method')) {
      metadata.parameters = this.extractParameters(node, code);
      metadata.returnType = this.extractReturnType(node, code, language);
    }

    // Calculate complexity (simple heuristic based on control flow nodes)
    metadata.complexity = this.calculateComplexity(node);

    return metadata;
  }

  private extractDocstring(node: any, code: string, language: SupportedLanguage): string | undefined {
    // Look for preceding comment nodes
    // This is a simplified implementation - could be enhanced
    return undefined;
  }

  private extractParameters(node: any, code: string): string[] {
    const parameters: string[] = [];
    
    const traverse = (n: any) => {
      if (n.type === 'formal_parameters' || n.type === 'parameters') {
        for (const param of n.children) {
          if (param.type === 'identifier' || param.type === 'parameter') {
            parameters.push(code.slice(param.startIndex, param.endIndex));
          }
        }
      }
      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return parameters;
  }

  private extractReturnType(node: any, code: string, language: SupportedLanguage): string | undefined {
    // Language-specific return type extraction
    // This is a simplified implementation
    return undefined;
  }

  private calculateComplexity(node: any): number {
    let complexity = 1; // Base complexity
    
    const complexityNodes = [
      'if_statement', 'while_statement', 'for_statement', 'switch_statement',
      'try_statement', 'catch_clause', 'conditional_expression'
    ];

    const traverse = (n: any) => {
      if (complexityNodes.includes(n.type)) {
        complexity++;
      }
      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return complexity;
  }
}

export const astParserService = new ASTParserService();
export default ASTParserService;