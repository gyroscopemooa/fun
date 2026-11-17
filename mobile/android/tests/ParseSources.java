import javax.tools.*;
import com.sun.source.util.JavacTask;
import java.util.*;
/** Parse only: no Android compilation, Gradle, APK or class files for app sources. */
public class ParseSources {
 public static void main(String[] paths) throws Exception {
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
  DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
  try(StandardJavaFileManager files=compiler.getStandardFileManager(diagnostics,null,java.nio.charset.StandardCharsets.UTF_8)) {
   JavacTask task=(JavacTask)compiler.getTask(null,files,diagnostics,List.of("-proc:none","--release","17"),null,files.getJavaFileObjectsFromStrings(Arrays.asList(paths)));
   task.parse();
   for(Diagnostic<?> d:diagnostics.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d.toString());
   System.out.println("PASS: parsed "+paths.length+" Java source files (syntax only, no app build).");
  }
 }
}
