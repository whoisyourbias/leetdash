class Solution {
    public void rotate(int[][] matrix) {
        for (int i = 0; i < matrix.length; i++){  
            for (int j = i + 1; j < matrix[i].length; j++){
                // (1) 전치 
                int tmp = matrix[i][j];
                matrix[i][j] = matrix[j][i]; 
                matrix[j][i] = tmp; 
                

            }
        }

        for (int i = 0; i < matrix.length; i++){  
            int write = 0; 
            // 두 포인터가 교차하기 전까지!! 
            for (int j = matrix[i].length-1; j > write; j--){    
                int tmp = matrix[i][j];
                matrix[i][j] = matrix[i][write];  
                matrix[i][write] = tmp; 
                write++; 
            }
        }

        
    }
}