from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import Document
from .serializers import DocumentSerializer
from .utils import get_embedding, compute_cosine_similarity, extract_text_from_file, get_best_snippet


class SearchDocumentsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q')

        if not query:
            return Response(
                {"error": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            query_vector = get_embedding(query)

            user_company = request.user.profile.company
            docs = Document.objects.filter(company=user_company)

            scored_results = []

            for doc in docs:
                doc_vector = doc.get_embedding()
                if doc_vector is not None:
                    score = compute_cosine_similarity(query_vector, doc_vector)
                    if score > 0.01:
                        scored_results.append((doc, score))

            scored_results.sort(key=lambda x: x[1], reverse=True)
            top_results = scored_results[:5]

            response_data = []

            for doc, score in top_results:
                serializer = DocumentSerializer(doc)
                data = serializer.data

                try:
                    print("We are opening the file.")
                    with doc.file.open('r') as f:
                        print(f)
                        content = extract_text_from_file(f)
                        print(content)

                    snippet = get_best_snippet(content, query_vector, context_lines=7)

                    data['snippet'] = snippet
                except Exception as e:
                    print(f"Error generating snippet for {doc.name}: {e}")
                    data['snippet'] = "Could not generate preview."

                data['similarity_score'] = round(float(score), 4)
                response_data.append(data)

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )