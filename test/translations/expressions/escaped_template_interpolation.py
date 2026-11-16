str = "problematic!"
print("Simple Template without escapes")
print(f"Simple Template with simple escapes: {10}")
print(f"${{Template with Terraform Escape sequence: {str}!}}")
print(f"${{Template with more escaped Terraform Escape sequence: {str}!}}")
print(f"${{Template with differently escaped Terraform Escape sequence: {str}!}}")
print(f"prefix ${{literal}} {str} suffix")
print(f"prefix \\\\${{literal}} {str} suffix")
print("${foo}")
print(f"""
${{escaped}}
{str}
""")
