import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;

class Solution {
    public int[] solution(String[] genres, int[] plays) {
        
        HashMap<String , Integer> totalPlay  = new HashMap<>();
        
        for(int i = 0; i < genres.length; i++) {
            totalPlay.put(
                genres[i] , 
                totalPlay.getOrDefault(genres[i], 0) + plays[i]);
        }
        
        HashMap<String, List<int[]>> songs = new HashMap<>();
        
        for(int i = 0; i < genres.length; i++) {
            
            songs.putIfAbsent(
                genres[i],
                new ArrayList<>()
            );
            
            songs.get(genres[i])
                .add(new int[] {i , plays[i]});
        }
        
        List<String> genreList = new ArrayList<>(totalPlay.keySet());
        genreList.sort((a, b) -> totalPlay.get(b) - totalPlay.get(a));
        
        
        List<Integer> result = new ArrayList<>();

        for (String genre : genreList) {

            List<int[]> list = songs.get(genre);
            list.sort((a, b) -> b[1] - a[1]);
            result.add(list.get(0)[0]);

            if (list.size() > 1) {
                result.add(list.get(1)[0]);
            }
            
        }
        
        int[] answer = new int [result.size()];
        
        for(int i = 0; i < result.size(); i++) {
            answer[i] = result.get(i);
        }
        
        
        return answer;
    }
}