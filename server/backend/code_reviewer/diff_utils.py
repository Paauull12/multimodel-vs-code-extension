import re

def parse_patch_to_numbered_lines(patch):
    lines = patch.split('\n')
    numbered_diff_lines = []
    valid_line_numbers = set()

    current_new_line = 0

    for line in lines:
        if line.startswith('@@'):
            match = re.search(r'\+([0-9]+)', line)
            if match:
                current_new_line = int(match.group(1))
            continue

        if line.startswith('-'):
            numbered_diff_lines.append(f"    | {line}")
        elif line.startswith('+'):
            numbered_diff_lines.append(f"{current_new_line:<4}| {line}")
            valid_line_numbers.add(current_new_line)
            current_new_line += 1
        else:
            # Context line (starts with space): Valid for comment
            numbered_diff_lines.append(f"{current_new_line:<4}| {line}")
            valid_line_numbers.add(current_new_line)
            current_new_line += 1

    return "\n".join(numbered_diff_lines), valid_line_numbers