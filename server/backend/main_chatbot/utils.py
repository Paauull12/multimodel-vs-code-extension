import os


def get_file_structure(path):
    if not os.path.exists(path):
        return f"Error: Path '{path}' does not exist."

    clean_path = os.path.normpath(path)
    root_name = os.path.basename(clean_path)

    # Output buffer
    lines = [f"{root_name}:"]

    def _walk(current_path, depth):
        indent = "  " * depth

        try:
            # Sort for deterministic output
            entries = sorted(os.listdir(current_path))
        except (PermissionError, OSError):
            return

        dirs = []
        files = []

        # Filter and categorize entries
        for entry in entries:
            # Skip hidden files and common ignore patterns
            if entry.startswith('.') or entry in [
                '__pycache__',
                'venv',
                'env',
                'node_modules',
                'dist',
                'build',
                '.idea',
                '.env'
            ]:
                continue

            full_entry_path = os.path.join(current_path, entry)
            if os.path.isdir(full_entry_path):
                dirs.append(entry)
            else:
                files.append(entry)

        # Process directories (nested objects)
        for d in dirs:
            lines.append(f"{indent}{d}:")
            _walk(os.path.join(current_path, d), depth + 1)

        # Process files (arrays of primitives)
        if files:
            count = len(files)
            # Check for commas in filenames to decide delimiter
            use_pipe = any(',' in f for f in files)
            delimiter = '|' if use_pipe else ','

            header_delim = '|' if use_pipe else ''

            file_string = delimiter.join(files)
            lines.append(f"{indent}files[{count}{header_delim}]: {file_string}")

    # Start recursion from inside the root folder
    if os.path.isdir(clean_path):
        _walk(clean_path, 1)

    return "\n".join(lines)