import java.util.HashMap;
class Solution {
    public boolean isValidSudoku(char[][] board) { 
        
        for(int rowIdx = 0; rowIdx < board.length; rowIdx++){
            HashMap<Integer, Integer> rowCnt = new HashMap<>();
            HashMap<Integer, Integer> colCnt = new HashMap<>();
           
            for(int colIdx = 0; colIdx < board[rowIdx].length; colIdx++){
                // 행 췤! 
                if(board[rowIdx][colIdx] != '.'){
                    int rowNum = board[rowIdx][colIdx] - '0'; 
                    rowCnt.put(rowNum, rowCnt.getOrDefault(rowNum, 0)+1);  

                }

                // 열 췍!
                if(board[colIdx][rowIdx] != '.'){
                    int colNum = board[colIdx][rowIdx] - '0'; 
                    colCnt.put(colNum, colCnt.getOrDefault(colNum, 0)+1);
                } 


            }
            
            // 스스스도쿠 
            for (int values : rowCnt.values()){
                if(values > 1) {
                    return false;
                }
            }

            for (int values : colCnt.values()){
                if(values > 1) {
                    return false;
                }
            }
        }
        // box 체크 ;;;; 
        for(int startRow = 0; startRow < 9; startRow += 3 ){
            for(int startCol = 0; startCol < 9; startCol += 3){
                 HashMap<Integer, Integer> boxCnt = new HashMap<>();

                for (int i = startRow; i < startRow+3; i++){
                    for (int j = startCol; j < startCol+3; j++){
                        if(board[i][j] != '.'){
                            int boxNum = board[i][j] - '0';
                            boxCnt.put(boxNum, boxCnt.getOrDefault(boxNum,0)+1);  
                        }

                    }
                } 
                for (int values : boxCnt.values()){
                    if (values > 1){
                        return false;
                    }
               }
            } 

        }
        return true;     
    }
}