# Feature: Rules Document upload
## 1. Chunking and Embeddings Methods
### 1.1. Data Indexing and Chunking 
#### Why is chunking important?
Chunking is about ensuring that every piece of text is optimized for retrieval and generation. Document chunking is crucial in Retrieval-Augmented Generation (RAG) for several reasons. It helps overcome token limits, improve retrieval accuracy, preserve context for generation, enhance processing efficiency, and be tailored to diverse document types. Chunking ensures that each document is treated with unique structure and meaning, ensuring seamless transitions between retrieval and generation. It also bridges gaps between retrieval and generation, minimizing overlaps in understanding. Overall, chunking acts as the glue that holds together the retrieval and generation processes, ensuring accurate, context-aware, and meaningful results every time.

#### Types of chunking
*Fixed-Size Chunking*
- involves dividing a document into uniform chunks based on a predetermined size, typically measured in characters, words, or tokens.<br>
**Advantages**: Simplicity, scalable, predictability <br>
**Disadvantages**: Loss of Context, irrelevance risk, inefficiency

*Sentence-Based Chunking*
- involves splitting a document at natural sentence boundaries and grouping a defined number of sentences into each chunk.<br>
**Advantages**: Preserves semantic flow, improved retrieval relevance, adaptable<br>
**Disadvantages**: Variable chunk sizes, complex implementation


*Semantic-Based Chunking*
- involves splitting a document into chunks based on the meaning or topic coherence rather than predefined sizes or structural elements.<br>
**Advantages**: Preserves semantic integrity, improved retrieval quality, adaptable and flexible<br>
**Disadvantages**: Variable chunk sizes, complex implementation, resource intensive


*Document-Specific Chunking*
- tailors the chunking process to the unique structure and content of a document. Instead of applying a one-size-fits-all strategy, this approach adapts to the document’s inherent characteristics, such as headings, tables, bullet points, or other structural elements.<br>
**Advantages**: Improved retrieval quality, preserves semantic context, customizable<br>
**Disadvantages**: Complex implementation, time-consuming, dependency on preprocessing


*Agentic Chunking*
- a text segmentation approach tailored to the tasks or roles an AI agent needs to perform.
**Advantages**: Task optimization, precision, multi-task support, enhanced interpretability<br>
**Disadvantages**: Complex implementation

### 1.2. Embedding
Embeddings convert text into high-dimensional numerical vectors that capture semantic meaning.

#### Types of embedding
*Word-Level Models*
- ex: Word2Vec, GloVe, FastText
- each word gets one embedding regardless of context

*Contextual Models*
- ex: BERT, RoBERTa, sentence-transformers
- embeddings change based on surrounding words

*Sentence/Document-Level Models*
- ex: Sentence-BERT, E5, OpenAI embeddings
- trained specifically to embed entire sentences/paragraphs, perfcet for document retrieval

## 2. Our approach
### 2.1. Chunking Strategy
**Semantic-Based Chunking**: Separate the document based on semantic boundaries. Each chunk should be a single, complete rule, section, or policy point.

### 2.2. Embedding Model Selection
**all-MiniLM-L6-v2**: A model that is fast and has a low dimensionality while still performing well on semantic text. It runs locally with minimal resources, no external API dependency and fast inference time. 

*Model size*: 22.7M params / ~80MB <br> *Embedding dimension*: 384 

