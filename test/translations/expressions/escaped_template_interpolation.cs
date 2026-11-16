var str = "problematic!";
Console.WriteLine("Simple Template without escapes");
Console.WriteLine($"Simple Template with simple escapes: {10}");
Console.WriteLine($"${{Template with Terraform Escape sequence: {str}!}}");
Console.WriteLine($"${{Template with more escaped Terraform Escape sequence: {str}!}}");
Console.WriteLine($"${{Template with differently escaped Terraform Escape sequence: {str}!}}");
Console.WriteLine($"prefix ${{literal}} {str} suffix");
Console.WriteLine($"prefix \\\\${{literal}} {str} suffix");
Console.WriteLine("${foo}");
Console.WriteLine($@"
${{escaped}}
{str}
");
