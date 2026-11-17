package net.manytool.app;
import java.util.LinkedHashSet;
import java.util.Locale;
public final class FileSelectionPolicy {
    public static String[] mimeTypes(String[] values) {
        LinkedHashSet<String> out=new LinkedHashSet<>();
        if(values!=null)for(String value:values){
            if(value==null)continue;
            for(String item:value.split(",")){
                String s=item.trim().toLowerCase(Locale.ROOT);
                switch(s){
                    case ".jpg":case ".jpeg":s="image/jpeg";break;
                    case ".png":s="image/png";break;
                    case ".webp":s="image/webp";break;
                    case ".heic":s="image/heic";break;
                    case ".pdf":s="application/pdf";break;
                    case ".txt":s="text/plain";break;
                }
                if(s.equals("*/*"))return new String[]{"*/*"};
                if(s.matches("[a-z0-9.+-]+/(?:[a-z0-9.+-]+|\\*)") && out.size()<16)out.add(s);
            }
        }
        return out.isEmpty()?new String[]{"*/*"}:out.toArray(new String[0]);
    }
    private FileSelectionPolicy(){}
}
