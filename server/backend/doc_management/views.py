from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Document
from .utils import get_embedding, compute_cosine_similarity, extract_text_from_file, get_best_snippet

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('dashboard')
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required(login_url='login')
def dashboard(request):
    try:
        company = request.user.profile.company
        if not company:
            raise ValueError("No Company Assigned")
    except Exception:
        return render(request, 'documents/error.html', {
            'message': 'You are not assigned to a company. Please contact support.'
        })

    documents = Document.objects.filter(company=company).order_by('-created_at')
    return render(request, 'documents/dashboard.html', {'documents': documents, 'company': company})


@login_required(login_url='login')
def upload_document(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        file = request.FILES.get('file')

        if name and file:
            try:
                text_content = extract_text_from_file(file)
                if not text_content:
                    raise ValueError("File is empty or not a valid text file.")

                vector = get_embedding(text_content)

                doc = Document(
                    company=request.user.profile.company,
                    uploaded_by=request.user,
                    name=name,
                    file=file
                )
                doc.set_embedding(vector)
                doc.save()

                return redirect('dashboard')
            except Exception as e:
                return render(request, 'documents/error.html', {'message': str(e)})

    return render(request, 'documents/upload.html')


@login_required(login_url='login')
def delete_document(request, doc_id):
    company = request.user.profile.company
    doc = get_object_or_404(Document, id=doc_id, company=company)

    if request.method == 'POST':
        doc.delete()

    return redirect('dashboard')


@login_required(login_url='login')
def search_documents(request):
    query = request.GET.get('q', '')
    results = []

    print(query)

    if query:
        query_vector = get_embedding(query)

        company = request.user.profile.company
        docs = Document.objects.filter(company=company)

        print(len(docs))

        scored_docs = []
        for doc in docs:
            doc_vector = doc.get_embedding()
            print(doc_vector)
            if doc_vector is not None:
                score = compute_cosine_similarity(query_vector, doc_vector)
                scored_docs.append((doc, score))

        scored_docs.sort(key=lambda x: x[1], reverse=True)
        results = scored_docs[:5]

    return render(request, 'documents/search.html', {'query': query, 'results': results})